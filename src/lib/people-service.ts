import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { hasPermission } from "@/domain/access";
import {
  personBody,
  publicPerson,
  redactPerson,
  type PersonBody,
  type PersonEntry,
} from "@/domain/people";
import { record, uuid, version } from "@/domain/operations";
import { audit, OperationError } from "./operation-api";
type Actor = { id: string; name: string; roles: string[] };
export function admin(actor: Actor) {
  return actor.roles.includes("administrator");
}
export function staffPeople(actor: Actor) {
  return (
    hasPermission(actor.roles, "content:publish") ||
    hasPermission(actor.roles, "members:review")
  );
}
export function privatePeople(actor: Actor) {
  return hasPermission(actor.roles, "members:review");
}
export async function ownPerson(client: PoolClient, actor: Actor) {
  let row = (
    await client.query("SELECT * FROM tpa.people WHERE user_id=$1", [actor.id])
  ).rows[0];
  if (!row) {
    const p =
      (
        await client.query(
          "SELECT * FROM tpa.member_profiles WHERE user_id=$1",
          [actor.id],
        )
      ).rows[0] ?? {};
    const body = personBody({
      name: actor.name,
      phone: p.phone ?? "",
      organization: p.organization ?? "",
      profession: p.profession ?? "",
      jobTitle: p.job_title ?? "",
      city: p.city ?? "",
    });
    row = (
      await client.query(
        "INSERT INTO tpa.people(id,user_id,accepted,draft) VALUES($1,$2,$3,$3) ON CONFLICT(user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING *",
        [randomUUID(), actor.id, body],
      )
    ).rows[0];
  }
  return row as PersonEntry;
}
export async function enriched(
  client: PoolClient,
  row: PersonEntry,
  actor: Actor,
) {
  const full = privatePeople(actor) || row.user_id === actor.id;
  row = {
    ...row,
    draft: personBody(row.draft),
    accepted: personBody(row.accepted),
  };
  const history = (
    await client.query(
      "SELECT id,version,action,created_at FROM tpa.person_revisions WHERE person_id=$1 ORDER BY created_at DESC LIMIT 100",
      [row.id],
    )
  ).rows;
  const reviews = (
    await client.query(
      'SELECT r.id,body,baseline,status,reason,proposed_by,u.name AS proposer_name,reviewed_by,r.created_at FROM tpa.profile_reviews r LEFT JOIN public."user" u ON u.id=r.proposed_by WHERE person_id=$1 ORDER BY r.created_at DESC LIMIT 100',
      [row.id],
    )
  ).rows.map((r) =>
    full
      ? r
      : {
          ...r,
          body: redactPerson(r.body),
          baseline: redactPerson(r.baseline),
        },
  );
  return {
    ...row,
    draft: full ? row.draft : redactPerson(row.draft),
    accepted: full ? row.accepted : redactPerson(row.accepted),
    history,
    reviews,
  };
}
async function validateReferences(
  client: PoolClient,
  personId: string,
  body: PersonBody,
  publishing = false,
) {
  for (const a of body.assignments) {
    const group = (
      await client.query(
        "SELECT g.*,p.published AS parent_published,p.archived AS parent_archived FROM tpa.profile_groups g LEFT JOIN tpa.profile_groups p ON p.id=g.parent_id WHERE g.id=$1 FOR SHARE OF g",
        [a.groupId],
      )
    ).rows[0];
    if (
      !group ||
      group.archived ||
      group.parent_archived ||
      (publishing &&
        (!group.published || (group.parent_id && !group.parent_published)))
    )
      throw new OperationError(
        "Choose an active group; publish its group before publishing a profile.",
      );
  }
  if (body.portraitId) {
    const valid =
      body.portraitKind === "profile"
        ? (
            await client.query(
              "SELECT 1 FROM tpa.profile_portraits WHERE id=$1 AND person_id=$2",
              [body.portraitId, personId],
            )
          ).rowCount
        : (
            await client.query(
              "SELECT 1 FROM tpa.public_media WHERE id=$1 AND published IS NOT NULL",
              [body.portraitId],
            )
          ).rowCount;
    if (!valid)
      throw new OperationError(
        "Choose your uploaded portrait or a published editorial portrait.",
      );
  }
}
export async function changePerson(
  client: PoolClient,
  actor: Actor,
  raw: unknown,
  ownerOnly = false,
) {
  const input = record(raw),
    action = String(input.action ?? "save");
  if (
    ![
      "save",
      "submit",
      "approve",
      "reject",
      "publish",
      "unpublish",
      "link",
    ].includes(action)
  )
    throw new OperationError("Choose a profile action.");
  if (ownerOnly && !["save", "submit"].includes(action))
    throw new OperationError("Access denied.", 403);
  const current = ownerOnly
    ? await ownPerson(client, actor)
    : input.id
      ? (
          await client.query(
            "SELECT * FROM tpa.people WHERE id=$1 FOR UPDATE",
            [uuid(input.id)],
          )
        ).rows[0]
      : null;
  // Acquire the same lock for owner and staff writers before checking the version.
  const row = current
    ? (
        await client.query("SELECT * FROM tpa.people WHERE id=$1 FOR UPDATE", [
          current.id,
        ])
      ).rows[0]
    : null;
  const expected = version(input.version);
  if (row ? row.version !== expected : expected !== 0)
    throw new OperationError(
      "This profile changed. Reload before continuing.",
      409,
    );
  if (!row && action !== "save")
    throw new OperationError("Save the profile first.");
  const id = row?.id ?? randomUUID();
  let draft: PersonBody = row?.draft;
  if (action === "save") {
    const submitted = record(input.body);
    if (
      ownerOnly &&
      ["assignments", "userId", "status", "verified"].some((k) =>
        Object.hasOwn(submitted, k),
      )
    )
      throw new OperationError(
        "Association assignments and verification are staff-managed.",
        403,
      );
    draft = personBody({
      ...row?.draft,
      ...submitted,
      ...(ownerOnly || !hasPermission(actor.roles, "content:publish")
        ? { assignments: row?.draft.assignments ?? [] }
        : {}),
      ...(!ownerOnly && !privatePeople(actor)
        ? { phone: row?.draft.phone ?? "" }
        : {}),
    });
    await validateReferences(client, id, draft);
    if (row)
      await client.query(
        "UPDATE tpa.people SET draft=$2,status=CASE WHEN status='pending' THEN 'pending' ELSE 'unverified' END,version=version+1,updated_at=now() WHERE id=$1",
        [id, draft],
      );
    else
      await client.query(
        "INSERT INTO tpa.people(id,accepted,draft) VALUES($1,$2,$2)",
        [id, draft],
      );
  } else if (action === "submit") {
    draft = personBody(row.draft);
    await validateReferences(client, id, draft);
    await client.query(
      "UPDATE tpa.profile_reviews SET status='superseded',reviewed_at=now() WHERE person_id=$1 AND status='pending'",
      [id],
    );
    await client.query(
      "INSERT INTO tpa.profile_reviews(id,person_id,body,baseline,status,proposed_by) VALUES($1,$2,$3,$4,'pending',$5)",
      [randomUUID(), id, draft, row.accepted, actor.id],
    );
    await client.query(
      "UPDATE tpa.people SET status='pending',version=version+1,updated_at=now() WHERE id=$1",
      [id],
    );
  } else if (action === "approve" || action === "reject") {
    if (!admin(actor))
      throw new OperationError("Only administrators can verify profiles.", 403);
    const review = (
      await client.query(
        "SELECT * FROM tpa.profile_reviews WHERE id=$1 AND person_id=$2 AND status='pending' FOR UPDATE",
        [uuid(input.reviewId), id],
      )
    ).rows[0];
    if (!review)
      throw new OperationError(
        "This review changed. Reload before deciding.",
        409,
      );
    if (JSON.stringify(review.body) !== JSON.stringify(row.draft))
      throw new OperationError(
        "The draft changed after submission. Submit the saved draft again.",
        409,
      );
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (reason.length > 2000 || (action === "reject" && !reason))
      throw new OperationError(
        "Provide a rejection reason, up to 2,000 characters.",
      );
    draft = personBody(review.body);
    await validateReferences(client, id, draft);
    await client.query(
      "UPDATE tpa.profile_reviews SET status=$2,reviewed_by=$3,reason=$4,reviewed_at=now() WHERE id=$1",
      [
        review.id,
        action === "approve" ? "approved" : "rejected",
        actor.id,
        reason,
      ],
    );
    if (action === "approve") {
      await client.query(
        "UPDATE tpa.people SET accepted=$2,draft=$2,status='verified',accepted_verified=true,version=version+1,updated_at=now() WHERE id=$1",
        [id, draft],
      );
      await client.query(
        "DELETE FROM tpa.person_assignments WHERE person_id=$1",
        [id],
      );
      for (const a of draft.assignments)
        await client.query(
          "INSERT INTO tpa.person_assignments(person_id,group_id,role,term,display_order) VALUES($1,$2,$3,$4,$5)",
          [id, a.groupId, a.role, a.term, a.order],
        );
      if (row.user_id)
        await client.query(
          'INSERT INTO tpa.member_profiles(user_id,phone,organization,profession,job_title,city,preferences) VALUES($1,$2,$3,$4,$5,$6,\'{"contact":"email"}\') ON CONFLICT(user_id) DO UPDATE SET phone=$2,organization=$3,profession=$4,job_title=$5,city=$6,updated_at=now()',
          [
            row.user_id,
            draft.phone,
            draft.organization,
            draft.profession,
            draft.jobTitle,
            draft.city,
          ],
        );
    } else
      await client.query(
        "UPDATE tpa.people SET status='rejected',version=version+1,updated_at=now() WHERE id=$1",
        [id],
      );
  } else if (action === "publish") {
    if (!hasPermission(actor.roles, "content:publish"))
      throw new OperationError("Access denied.", 403);
    if (
      !row.accepted_verified ||
      row.status !== "verified" ||
      JSON.stringify(row.draft) !== JSON.stringify(row.accepted)
    )
      throw new OperationError(
        "Only the verified, unchanged profile can be published.",
      );
    if (!row.accepted.assignments?.length)
      throw new OperationError(
        "Assign an association group before publishing.",
      );
    if (input.confirmPublication !== true)
      throw new OperationError(
        "Confirm permission to publish this profile and portrait.",
      );
    await validateReferences(client, id, row.accepted, true);
    await client.query(
      "UPDATE tpa.people SET published=$2,version=version+1,updated_at=now() WHERE id=$1",
      [id, { ...publicPerson(row.accepted), verified: true }],
    );
  } else if (action === "unpublish") {
    if (!hasPermission(actor.roles, "content:publish"))
      throw new OperationError("Access denied.", 403);
    await client.query(
      "UPDATE tpa.people SET published=NULL,version=version+1,updated_at=now() WHERE id=$1",
      [id],
    );
  } else {
    if (!admin(actor))
      throw new OperationError("Only administrators can link accounts.", 403);
    const userId = input.userId === null ? null : String(input.userId ?? "");
    if (
      userId &&
      !(await client.query('SELECT 1 FROM public."user" WHERE id=$1', [userId]))
        .rowCount
    )
      throw new OperationError("Account not found.");
    if (userId) {
      const other = (
        await client.query(
          "SELECT * FROM tpa.people WHERE user_id=$1 AND id<>$2 FOR UPDATE",
          [userId, id],
        )
      ).rows[0];
      if (other) {
        if (
          other.published ||
          other.accepted_verified ||
          (other.draft.assignments ?? []).length ||
          JSON.stringify(other.draft) !== JSON.stringify(other.accepted) ||
          (
            await client.query(
              "SELECT 1 FROM tpa.profile_reviews WHERE person_id=$1 UNION ALL SELECT 1 FROM tpa.profile_portraits WHERE person_id=$1 UNION ALL SELECT 1 FROM tpa.person_revisions WHERE person_id=$1 LIMIT 1",
              [other.id],
            )
          ).rowCount
        )
          throw new OperationError(
            "This account already has a working profile. Use that person and add assignments instead.",
            409,
          );
        await client.query("DELETE FROM tpa.people WHERE id=$1", [other.id]);
      }
    }
    await client.query(
      "UPDATE tpa.people SET user_id=$2,version=version+1,updated_at=now() WHERE id=$1",
      [id, userId],
    );
  }
  const result = (
    await client.query("SELECT * FROM tpa.people WHERE id=$1", [id])
  ).rows[0];
  await client.query(
    "INSERT INTO tpa.person_revisions(id,person_id,version,action,body,actor_id) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), id, result.version, action, result.draft, actor.id],
  );
  await audit(client, actor.id, `person.${action}`, id);
  return enriched(client, result, actor);
}
