import {
  operation,
  authorized,
  jsonBody,
  transaction,
  OperationError,
  audit,
} from "@/lib/operation-api";
import {
  policy,
  publishPolicy,
  reviewVerification,
  verificationImpact,
} from "@/lib/verification-service";
import { getDatabase } from "@/lib/database";
import { validateFields } from "@/domain/verification";
export async function GET(r: Request) {
  return operation(async () => {
    const actor = await authorized(r, "members:review"),
      db = getDatabase(),
      p = await policy();
    const page = Math.max(
      1,
      Math.min(10000, Number(new URL(r.url).searchParams.get("page")) || 1),
    );
    const offset = (Math.floor(page) - 1) * 100;
    const params = new URL(r.url).searchParams;
    const status = params.get("status") || "all";
    const q =
      "%" +
      (params.get("q") || "").slice(0, 120).replace(/[\\%_]/g, "\\$&") +
      "%";
    const id = params.get("id") || "";
    const verifiedPage = Math.max(
      1,
      Math.min(10000, Number(params.get("verifiedPage")) || 1),
    );
    const reviews = (
      await db.query(
        "SELECT s.*,v.fields AS requirement_fields,u.name,u.email,p.accepted_verified,p.verification_update_requested FROM tpa.verification_submissions s JOIN tpa.verification_policies v ON v.version=s.requirement_version JOIN public.\"user\" u ON u.id=s.user_id JOIN tpa.people p ON p.id=s.person_id WHERE ($2='all' OR s.status=$2) AND concat_ws(' ',u.name,u.email) ILIKE $3 AND ($4='' OR s.id::text=$4) ORDER BY (s.status='pending') DESC,s.created_at DESC LIMIT 101 OFFSET $1",
        [offset, status, q, id],
      )
    ).rows;
    const verified = (
      await db.query(
        `SELECT p.id,p.version,u.name,u.email,p.verification_version,p.verification_update_requested FROM tpa.people p JOIN public."user" u ON u.id=p.user_id WHERE p.accepted_verified=true AND concat_ws(' ',u.name,u.email) ILIKE $2 ORDER BY u.name LIMIT 101 OFFSET $1`,
        [(Math.floor(verifiedPage) - 1) * 100, q],
      )
    ).rows;
    const draft = actor.roles.includes("administrator")
      ? (
          await db.query(
            "SELECT * FROM tpa.verification_policy_draft WHERE id=true",
          )
        ).rows[0]
      : null;
    return {
      policy: p,
      draft,
      admin: actor.roles.includes("administrator"),
      reviews: reviews.slice(0, 100),
      verified: verified.slice(0, 100),
      hasMore: reviews.length > 100 || verified.length > 100,
      page,
      verifiedPage,
      reviewsMore: reviews.length > 100,
      verifiedMore: verified.length > 100,
      history: (
        await db.query(
          "SELECT action,entity_id,created_at FROM tpa.audit_events WHERE action LIKE 'verification.%' ORDER BY created_at DESC LIMIT 100",
        )
      ).rows,
    };
  });
}
export async function POST(r: Request) {
  return operation(async () => {
    if (process.env.ONBOARDING_ENABLED !== "true")
      throw new OperationError("Onboarding is disabled.", 503);
    const actor = await authorized(r, "members:review", true),
      input = await jsonBody(r);
    if (
      !actor.roles.includes("administrator") &&
      input.action !== "corrections"
    )
      throw new OperationError("Administrator control required.", 403);
    return transaction(async (c) => {
      if (["approve", "reject", "corrections", "revoke"].includes(input.action))
        return reviewVerification(c, actor, input);
      const p = await policy(c);
      const prior = (
        await c.query("SELECT fields FROM tpa.verification_policies")
      ).rows.flatMap((x) => x.fields);
      const fields = validateFields(input.fields, prior);
      if (input.action === "impact") {
        return {
          affected: (await verificationImpact(c, fields, p.fields)).length,
        };
      }
      if (input.action === "publish")
        return publishPolicy(c, actor, fields, input.version);
      if (input.action !== "save")
        throw new OperationError("Choose an action.");
      await c.query(
        "INSERT INTO tpa.verification_policy_draft(id,fields) VALUES(true,$1) ON CONFLICT DO NOTHING",
        [JSON.stringify(p.fields)],
      );
      const row = (
        await c.query(
          "UPDATE tpa.verification_policy_draft SET fields=$1,version=version+1 WHERE id=true AND version=$2 RETURNING *",
          [JSON.stringify(fields), input.version],
        )
      ).rows[0];
      if (!row) throw new OperationError("Requirements changed. Reload.", 409);
      await audit(
        c,
        actor.id,
        "verification.requirements_saved",
        String(row.version),
      );
      return row;
    });
  });
}
