import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { getDatabase } from "./database";
import {
  initialFields,
  validateAnswers,
  missingFields,
  requirementUpdateNeeded,
  type VerificationField,
} from "@/domain/verification";
import { ownPerson } from "./people-service";
import { personBody } from "@/domain/people";
import { OperationError, audit } from "./operation-api";
import {
  queueOnboardingMail,
  sealMail,
  onboardingEmail,
} from "./onboarding-mail";
type Actor = { id: string; name: string; email: string; roles: string[] };
export async function policy(
  db: PoolClient | ReturnType<typeof getDatabase> = getDatabase(),
) {
  await db.query(
    "INSERT INTO tpa.verification_policies(version,fields) VALUES(1,$1) ON CONFLICT DO NOTHING",
    [JSON.stringify(initialFields)],
  );
  return (
    await db.query(
      "SELECT * FROM tpa.verification_policies ORDER BY version DESC LIMIT 1",
    )
  ).rows[0] as { version: number; fields: VerificationField[] };
}
export async function memberVerification(actor: Actor) {
  const db = getDatabase(),
    p = await policy();
  const user = (
    await db.query('SELECT "emailVerified" FROM public."user" WHERE id=$1', [
      actor.id,
    ])
  ).rows[0];
  const draft = (
    await db.query("SELECT * FROM tpa.application_drafts WHERE user_id=$1", [
      actor.id,
    ])
  ).rows[0];
  const person = (
    await db.query(
      "SELECT accepted_verified,verification_version,verification_update_requested FROM tpa.people WHERE user_id=$1",
      [actor.id],
    )
  ).rows[0];
  const reviews = (
    await db.query(
      "SELECT id,status,reason,created_at,reviewed_at,requirement_version,version FROM tpa.verification_submissions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20",
      [actor.id],
    )
  ).rows;
  return {
    policy: p,
    emailVerified: !!user?.emailVerified,
    email: actor.email,
    verified: !!person?.accepted_verified,
    updateRequested: !!person?.verification_update_requested,
    approvedVersion: person?.verification_version ?? null,
    reviews,
    missing: missingFields(
      p.fields,
      draft?.details ?? {},
      draft?.category ?? "Professional",
      !!user?.emailVerified,
    ),
  };
}
export async function submitVerification(
  client: PoolClient,
  actor: Actor,
  expected: number,
) {
  await client.query('SELECT id FROM public."user" WHERE id=$1 FOR UPDATE', [
    actor.id,
  ]);
  const user = (
    await client.query(
      'SELECT "emailVerified" FROM public."user" WHERE id=$1',
      [actor.id],
    )
  ).rows[0];
  const draft = (
    await client.query(
      "SELECT * FROM tpa.application_drafts WHERE user_id=$1 FOR UPDATE",
      [actor.id],
    )
  ).rows[0];
  if (!draft || draft.version !== expected)
    throw new OperationError("Save the latest form before submitting.", 409);
  const p = await policy(client);
  const answers = validateAnswers(draft.details, p.fields),
    missing = missingFields(
      p.fields,
      answers,
      draft.category,
      !!user.emailVerified,
    );
  if (missing.length)
    throw new OperationError("Complete: " + missing.join(", "));
  for (const f of p.fields.filter(
    (f) => f.type === "document" && answers[f.id],
  )) {
    if (
      !(
        await client.query(
          "SELECT 1 FROM tpa.private_documents WHERE id::text=$1 AND owner_user_id=$2 AND kind=$3",
          [answers[f.id], actor.id, f.documentKind],
        )
      ).rowCount
    )
      throw new OperationError(
        "Select your own document with the correct purpose.",
        403,
      );
  }
  const person = await ownPerson(client, actor);
  const body = personBody({
    ...person.draft,
    name: answers.fullName,
    phone: answers.phone,
    organization: answers.organization ?? person.draft.organization,
  });
  await client.query(
    "UPDATE tpa.verification_submissions SET status='superseded',reviewed_at=now() WHERE user_id=$1 AND status='pending'",
    [actor.id],
  );
  const id = randomUUID();
  await client.query(
    "INSERT INTO tpa.verification_submissions(id,user_id,person_id,requirement_version,snapshot,person_snapshot) VALUES($1,$2,$3,$4,$5,$6)",
    [
      id,
      actor.id,
      person.id,
      p.version,
      {
        ...draft,
        details: answers,
        personVersion: person.version,
        submittedAt: new Date().toISOString(),
      },
      body,
    ],
  );
  await audit(client, actor.id, "verification.submitted", id);
  return { submitted: true, id };
}
export async function reviewVerification(
  client: PoolClient,
  actor: Actor,
  input: Record<string, unknown>,
) {
  if (!actor.roles.includes("administrator") && input.action !== "corrections")
    throw new OperationError("Administrator decision required.", 403);
  const action = String(input.action),
    reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (
    !["approve", "reject", "corrections", "revoke"].includes(action) ||
    reason.length > 2000 ||
    (action !== "approve" && !reason)
  )
    throw new OperationError("Provide a reason for this decision.");
  if (action === "revoke") {
    const person = (
      await client.query(
        "SELECT * FROM tpa.people WHERE id::text=$1 FOR UPDATE",
        [input.personId],
      )
    ).rows[0];
    if (!person || person.version !== input.version)
      throw new OperationError("Profile changed.", 409);
    await client.query(
      "UPDATE tpa.people SET accepted_verified=false,published=NULL,status='unverified',version=version+1,updated_at=now() WHERE id=$1",
      [person.id],
    );
    await audit(client, actor.id, "verification.revoked", person.id);
    await client.query(
      "INSERT INTO tpa.person_revisions(id,person_id,version,action,body,actor_id) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        person.id,
        person.version + 1,
        "verification.revoked",
        { reason, accepted: person.accepted },
        actor.id,
      ],
    );
    return { saved: true };
  }
  const r = (
    await client.query(
      "SELECT * FROM tpa.verification_submissions WHERE id::text=$1 AND status='pending' FOR UPDATE",
      [input.id],
    )
  ).rows[0];
  if (!r || r.version !== input.version)
    throw new OperationError("Review changed. Reload.", 409);
  const person = (
    await client.query("SELECT * FROM tpa.people WHERE id=$1 FOR UPDATE", [
      r.person_id,
    ])
  ).rows[0];
  if (person.version !== r.snapshot.personVersion)
    throw new OperationError(
      "The profile changed after submission. Request a new submission.",
      409,
    );
  if (action === "approve") {
    const verified = (
      await client.query(
        'SELECT "emailVerified" FROM public."user" WHERE id=$1',
        [r.user_id],
      )
    ).rows[0];
    if (!verified?.emailVerified)
      throw new OperationError("Account email must be verified.");
    const current = await policy(client);
    const updateRequested =
      missingFields(
        current.fields,
        r.snapshot.details,
        r.snapshot.category,
        true,
      ).length > 0;
    await client.query(
      "UPDATE tpa.people SET accepted=$2,draft=$2,accepted_verified=true,verification_version=$3,verification_update_requested=$4,version=version+1,status='verified',updated_at=now() WHERE id=$1",
      [r.person_id, r.person_snapshot, r.requirement_version, updateRequested],
    );
    if (updateRequested) {
      const account = (
        await client.query('SELECT email FROM public."user" WHERE id=$1', [
          r.user_id,
        ])
      ).rows[0];
      await queueOnboardingMail(
        client,
        r.user_id,
        account.email,
        "update",
        `${process.env.BETTER_AUTH_URL}/member/application`,
        `requirements-${current.version}-${r.user_id}`,
      );
    }
  }
  await client.query(
    "UPDATE tpa.verification_submissions SET status=$2,reason=$3,reviewed_by=$4,reviewed_at=now(),version=version+1 WHERE id=$1",
    [
      r.id,
      action === "approve"
        ? "approved"
        : action === "reject"
          ? "rejected"
          : "corrections",
      reason,
      actor.id,
    ],
  );
  await audit(client, actor.id, "verification." + action, r.id);
  return { saved: true };
}
export async function publishPolicy(
  client: PoolClient,
  actor: Actor,
  fields: VerificationField[],
  expected: number,
) {
  await client.query(
    "SELECT id FROM tpa.verification_policy_draft WHERE id=true FOR UPDATE",
  );
  const d = (
    await client.query(
      "SELECT * FROM tpa.verification_policy_draft WHERE id=true",
    )
  ).rows[0];
  if (!d || d.version !== expected)
    throw new OperationError("Requirements changed. Reload.", 409);
  if (!isDeepStrictEqual(d.fields, fields))
    throw new OperationError(
      "Save the requirements draft before publishing.",
      409,
    );
  const last = await policy(client),
    next = last.version + 1;
  await client.query(
    "INSERT INTO tpa.verification_policies(version,fields,actor_id) VALUES($1,$2,$3)",
    [next, JSON.stringify(fields), actor.id],
  );
  await client.query(
    "UPDATE tpa.verification_policy_draft SET version=version+1 WHERE id=true",
  );
  const accounts = await verificationImpact(client, fields, last.fields);
  const affectedAccounts = [];
  for (const a of accounts) affectedAccounts.push(a);
  if (affectedAccounts.length) {
    await client.query(
      "UPDATE tpa.people SET verification_update_requested=true WHERE id=ANY($1::uuid[])",
      [affectedAccounts.map((a) => a.id)],
    );
    const jobs = affectedAccounts.map((a) => ({
      id: randomUUID(),
      dedupe: `requirements-${next}-${a.user_id}`,
      user_id: a.user_id,
      recipient: a.email,
      payload: sealMail(
        onboardingEmail(
          "update",
          `${process.env.BETTER_AUTH_URL}/member/application`,
        ),
      ),
    }));
    await client.query(
      "INSERT INTO tpa.onboarding_mail(id,dedupe,user_id,recipient,kind,payload) SELECT id,dedupe,user_id,recipient,'update',payload FROM jsonb_to_recordset($1::jsonb) AS j(id uuid,dedupe text,user_id text,recipient text,payload jsonb) ON CONFLICT(dedupe) DO NOTHING",
      [JSON.stringify(jobs)],
    );
  }
  await audit(
    client,
    actor.id,
    "verification.requirements_published",
    String(next),
  );
  return { published: true, version: next, affected: affectedAccounts.length };
}

export async function verificationImpact(
  client: PoolClient,
  fields: VerificationField[],
  previous: VerificationField[],
) {
  const accounts = (
    await client.query(
      `SELECT p.id,p.user_id,u.email,s.snapshot,v.fields AS approved_fields FROM tpa.people p JOIN public."user" u ON u.id=p.user_id LEFT JOIN LATERAL (SELECT snapshot,requirement_version FROM tpa.verification_submissions WHERE person_id=p.id AND status='approved' ORDER BY reviewed_at DESC LIMIT 1) s ON true LEFT JOIN tpa.verification_policies v ON v.version=s.requirement_version WHERE p.accepted_verified=true`,
    )
  ).rows;
  return accounts.filter((a) =>
    requirementUpdateNeeded(
      fields,
      a.approved_fields ?? previous,
      a.snapshot?.details ?? {},
      a.snapshot?.category ?? "Professional",
    ),
  );
}
