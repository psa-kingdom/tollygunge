import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { OperationError } from "./operation-error";
import { audit } from "./operation-audit";

/** Run inside a transaction. Keep membership/account history recoverable. */
export async function deleteMember(
  client: Pick<PoolClient, "query">,
  actorId: string,
  personId: string,
  personVersion: number,
  membershipVersion: number,
) {
  const member = (await client.query(
    `SELECT p.version AS person_version,p.archived_at,m.version AS membership_version
     FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id
     WHERE p.id=$1 FOR UPDATE OF p,m`, [personId],
  )).rows[0];
  if (!member) throw new OperationError("Member not found.", 404);
  if (member.archived_at) throw new OperationError("Member is already deleted.", 409);
  if (member.person_version !== personVersion || member.membership_version !== membershipVersion)
    throw new OperationError("Member changed. Reload before deleting.", 409);
  await client.query(
    "UPDATE tpa.people SET archived_at=now(),published=NULL,version=version+1,updated_at=now() WHERE id=$1", [personId],
  );
  await client.query(
    "INSERT INTO tpa.person_revisions(id,person_id,version,action,body,actor_id) SELECT $1,id,version,'archive',draft,$2 FROM tpa.people WHERE id=$3",
    [randomUUID(), actorId, personId],
  );
  await audit(client as PoolClient, actorId, "member.deleted", personId);
  return { deleted: true, recoverable: true };
}

async function retireArchivedLogin(
  client: Pick<PoolClient, "query">,
  actorId: string,
  userId: string,
  expectedEmail?: string,
) {
  const { rows: [account] } = await client.query(
    'SELECT lower(btrim(email)) AS email FROM public."user" WHERE id=$1 FOR UPDATE',
    [userId],
  );
  if (!account || (expectedEmail !== undefined && account.email !== expectedEmail)) return false;
  const protectedAccount = await client.query(
    `SELECT 1 WHERE EXISTS(SELECT FROM tpa.staff_roles WHERE user_id=$1)
      OR EXISTS(SELECT FROM tpa.operator_approved_identities WHERE user_id=$1)`,
    [userId],
  );
  if (userId === actorId || protectedAccount.rowCount)
    throw new OperationError(
      "This email belongs to a staff account. Restore the record from Archives to edit its membership, or have an authorized administrator remove staff access before deleting the account.",
      409,
      "staff_account_retained",
    );

  // Keep the user ID for historical references while releasing its sign-in email.
  await client.query(
    `UPDATE public."user" SET email=$2,"emailVerified"=false,"updatedAt"=now() WHERE id=$1`,
    [userId, `deleted-${randomUUID()}@accounts.invalid`],
  );
  await client.query('DELETE FROM public."session" WHERE "userId"=$1', [userId]);
  await client.query('DELETE FROM public."account" WHERE "userId"=$1', [userId]);
  await client.query(
    `DELETE FROM public."verification" WHERE value=$1 AND identifier LIKE 'reset-password:%'`,
    [userId],
  );
  return true;
}

export async function releasePreviouslyDeletedEmail(
  client: Pick<PoolClient, "query">,
  actorId: string,
  email: string,
) {
  const { rows } = await client.query(
    `SELECT p.id,p.user_id,lower(btrim(u.email))=$1 AS matches_login
     FROM tpa.people p LEFT JOIN public."user" u ON u.id=p.user_id
     WHERE p.directory_deleted_at IS NOT NULL
       AND (lower(btrim(p.contact_email))=$1 OR lower(btrim(u.email))=$1)
     ORDER BY p.id FOR UPDATE OF p`,
    [email],
  );
  for (const person of rows) {
    if (person.matches_login && await retireArchivedLogin(client, actorId, person.user_id, email))
      await audit(client as PoolClient, actorId, "member.archived_login_retired", person.id);
    await client.query(
      "UPDATE tpa.people SET contact_email=NULL WHERE id=$1 AND lower(btrim(contact_email))=$2",
      [person.id, email],
    );
  }
}

export async function resolveArchivedMember(
  client: Pick<PoolClient, "query">,
  actorId: string,
  personId: string,
  personVersion: number,
  membershipVersion: number,
  action: "restore" | "delete-archived",
) {
  const { rows: [person] } = await client.query(
    `SELECT version,archived_at,directory_deleted_at,user_id,
       EXISTS(SELECT FROM tpa.staff_roles WHERE user_id=p.user_id)
       OR EXISTS(SELECT FROM tpa.operator_approved_identities WHERE user_id=p.user_id) AS protected_account
     FROM tpa.people p WHERE id=$1 FOR UPDATE`,
    [personId],
  );
  if (!person || (person.directory_deleted_at && (action !== "restore" || !person.protected_account)))
    throw new OperationError("Archived record not found.", 404);

  const { rows: [membership] } = await client.query(
    "SELECT version FROM tpa.memberships WHERE person_id=$1 FOR UPDATE",
    [personId],
  );
  if (!person.archived_at || person.version !== personVersion || (membership?.version ?? 0) !== membershipVersion)
    throw new OperationError("Member record changed. Reload before continuing.", 409);

  const restoring = action === "restore";
  if (!restoring && person.user_id)
    await retireArchivedLogin(client, actorId, person.user_id);
  await client.query(
    `UPDATE tpa.people SET
      archived_at=CASE WHEN $2 THEN NULL ELSE archived_at END,
      directory_deleted_at=CASE WHEN $2 THEN NULL ELSE now() END,
      contact_email=CASE WHEN $2 THEN contact_email ELSE NULL END,
      published=NULL,version=version+1,updated_at=now()
      WHERE id=$1`,
    [personId, restoring],
  );
  await client.query(
    "INSERT INTO tpa.person_revisions(id,person_id,version,action,body,actor_id) SELECT $1,id,version,$2,draft,$3 FROM tpa.people WHERE id=$4",
    [randomUUID(), restoring ? "restore" : "delete", actorId, personId],
  );
  await audit(client as PoolClient, actorId, restoring ? "person.restore" : "member.archived_record_deleted", personId);
  return { saved: true };
}

export async function archiveAccountRecord(
  client: PoolClient,
  actorId: string,
  userId: string,
  personVersion: number,
) {
  const { rows: [account] } = await client.query(
    'SELECT name FROM public."user" WHERE id=$1 FOR UPDATE',
    [userId],
  );
  if (!account) throw new OperationError("Account not found.", 404);

  const { rows: [person] } = await client.query(
    `SELECT p.id,p.version,p.archived_at,
       EXISTS(SELECT FROM tpa.memberships m WHERE m.person_id=p.id) AS has_membership
     FROM tpa.people p WHERE p.user_id=$1 FOR UPDATE OF p`,
    [userId],
  );
  if (person?.archived_at || person?.has_membership || (person?.version ?? 0) !== personVersion)
    throw new OperationError("Directory record changed. Reload before deleting.", 409);

  const personId = person?.id ?? randomUUID();
  if (!person) {
    await client.query(
      "INSERT INTO tpa.people(id,user_id,accepted,draft,archived_at) VALUES($1,$2,$3,$3,now())",
      [personId, userId, { name: account.name }],
    );
  } else {
    await client.query(
      "UPDATE tpa.people SET archived_at=now(),published=NULL,version=version+1,updated_at=now() WHERE id=$1",
      [personId],
    );
  }
  await client.query(
    "INSERT INTO tpa.person_revisions(id,person_id,version,action,body,actor_id) SELECT $1,id,version,'archive',draft,$2 FROM tpa.people WHERE id=$3",
    [randomUUID(), actorId, personId],
  );
  await audit(client, actorId, "member.deleted", personId);
  return { deleted: true, recoverable: true };
}
