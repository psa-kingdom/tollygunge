import {
  randomUUID,
  randomBytes,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  emailConfigured,
  tokenHash,
  emailAddress,
  inboxAddress,
} from "../domain/email";
export class EmailOperationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function emailTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function emailAudit(
  client: PoolClient,
  actor: string,
  action: string,
  id: string,
) {
  await client.query(
    "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,$2,$3)",
    [actor, action, id],
  );
}
export async function emailReadiness(pool: Pool) {
  const state = (
    await pool.query(
      "SELECT heartbeat_at,status,quota,quota_checked_at,heartbeat_at>now()-interval '90 seconds' AS healthy FROM tpa.email_worker_state WHERE id='email'",
    )
  ).rows[0];
  return {
    configured: emailConfigured(),
    healthy: !!state?.healthy,
    worker: state?.status ?? "not_started",
    heartbeat: state?.heartbeat_at ?? null,
    quota: state?.quota ?? null,
    quotaCheckedAt: state?.quota_checked_at ?? null,
    enabled: emailConfigured() && !!state?.healthy && state.status === "ready",
  };
}
const eligible =
  "coalesce(n.subscribed,false) AND u.\"emailVerified\" AND coalesce(p.preferences->>'contact','email')='email' AND s.email IS NULL";
export async function campaignRecipients(
  client: PoolClient,
  audience: { city: string; profession: string },
) {
  return (
    await client.query(
      `SELECT u.id,u.name,u.email FROM public."user" u LEFT JOIN tpa.member_profiles p ON p.user_id=u.id LEFT JOIN tpa.newsletter_consents n ON n.user_id=u.id LEFT JOIN tpa.email_suppressions s ON s.email=lower(u.email) WHERE ($1='' OR lower(coalesce(p.city,''))=lower($1)) AND ($2='' OR lower(coalesce(p.profession,''))=lower($2)) AND ${eligible} ORDER BY u.id LIMIT 10001`,
      [audience.city, audience.profession],
    )
  ).rows as { id: string; name: string; email: string }[];
}
type ReviewProof = {
  id: string;
  version: number;
  actor: string;
  digest: string;
  expires: number;
};
function proofDigest(recipients: { id: string; email: string }[]) {
  return tokenHash(JSON.stringify(recipients.map((x) => [x.id, x.email])));
}
function sign(proof: ReviewProof, secret = process.env.BETTER_AUTH_SECRET!) {
  const body = Buffer.from(JSON.stringify(proof)).toString("base64url");
  return (
    body +
    "." +
    createHmac("sha256", secret)
      .update("tpa-campaign-review\0" + body)
      .digest("base64url")
  );
}
function verify(value: unknown): ReviewProof {
  try {
    if (typeof value !== "string" || value.length > 2000) throw Error();
    const [body, sig, ...rest] = value.split(".");
    if (rest.length) throw Error();
    const expected = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
      .update("tpa-campaign-review\0" + body)
      .digest();
    const actual = Buffer.from(sig, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw Error();
    const proof = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!Number.isFinite(proof.expires) || proof.expires < Date.now())
      throw Error();
    return proof;
  } catch {
    throw new EmailOperationError(
      "Audience review expired. Review the saved campaign again.",
      409,
    );
  }
}
export async function reviewCampaign(
  pool: Pool,
  actor: string,
  id: string,
  version: number,
) {
  const readiness = await emailReadiness(pool);
  return emailTransaction(pool, async (client) => {
    const campaign = (
      await client.query("SELECT * FROM tpa.campaign_drafts WHERE id=$1", [id])
    ).rows[0];
    if (!campaign) throw new EmailOperationError("Campaign not found.", 404);
    if (campaign.version !== version || campaign.status !== "draft")
      throw new EmailOperationError(
        "Campaign changed. Reload the saved draft.",
        409,
      );
    const recipients = await campaignRecipients(client, campaign.audience);
    if (recipients.length > 10000)
      throw new EmailOperationError(
        "More than 10,000 recipients match. Narrow the audience.",
      );
    return {
      campaign: {
        id: campaign.id,
        version: campaign.version,
        name: campaign.name,
        subject: campaign.subject,
        body: campaign.body,
      },
      eligible: recipients.length,
      sample: recipients
        .slice(0, 20)
        .map((x) => ({ name: x.name, email: x.email })),
      reviewToken: sign({
        id,
        version,
        actor,
        digest: proofDigest(recipients),
        expires: Date.now() + 10 * 60000,
      }),
      readiness,
    };
  });
}
export async function dispatchCampaign(
  pool: Pool,
  actor: string,
  id: string,
  version: number,
  reviewToken: unknown,
) {
  const ready = await emailReadiness(pool);
  if (!ready.enabled)
    throw new EmailOperationError(
      "Email worker is unavailable. Your draft is retained.",
      503,
    );
  const proof = verify(reviewToken);
  if (proof.actor !== actor || proof.id !== id || proof.version !== version)
    throw new EmailOperationError(
      "Review this saved campaign before sending.",
      409,
    );
  return emailTransaction(pool, async (client) => {
    const campaign = (
      await client.query(
        "SELECT * FROM tpa.campaign_drafts WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!campaign) throw new EmailOperationError("Campaign not found.", 404);
    if (campaign.version !== version || campaign.status !== "draft")
      throw new EmailOperationError("Campaign changed. Review again.", 409);
    const existing = (
      await client.query(
        "SELECT id FROM tpa.email_dispatches WHERE campaign_id=$1 AND campaign_version=$2",
        [id, version],
      )
    ).rows[0];
    if (existing) return { id: existing.id, duplicate: true };
    const recipients = await campaignRecipients(client, campaign.audience);
    if (!recipients.length || recipients.length > 10000)
      throw new EmailOperationError(
        "Choose an audience containing 1–10,000 eligible recipients.",
      );
    if (proof.digest !== proofDigest(recipients))
      throw new EmailOperationError(
        "Audience changed. Review again before sending.",
        409,
      );
    const dispatch = randomUUID();
    await client.query(
      "INSERT INTO tpa.email_dispatches(id,campaign_id,campaign_version,snapshot,created_by) VALUES($1,$2,$3,$4,$5)",
      [
        dispatch,
        id,
        version,
        {
          name: campaign.name,
          subject: campaign.subject,
          body: campaign.body,
          audience: campaign.audience,
        },
        actor,
      ],
    );
    const jobs = [],
      tokens = [];
    for (const person of recipients) {
      const token = randomBytes(32).toString("base64url");
      tokens.push({ hash: tokenHash(token), user: person.id });
      jobs.push({
        id: randomUUID(),
        user: person.id,
        email: emailAddress(person.email),
        payload: {
          subject: campaign.subject,
          body: campaign.body,
          unsubscribe: `${process.env.BETTER_AUTH_URL}/unsubscribe#token=${token}`,
        },
      });
    }
    await client.query(
      'INSERT INTO tpa.email_unsubscribe_tokens(token_hash,user_id) SELECT x.hash,x."user" FROM jsonb_to_recordset($1::jsonb) AS x(hash text,"user" text)',
      [JSON.stringify(tokens)],
    );
    await client.query(
      'INSERT INTO tpa.email_jobs(id,kind,dispatch_id,user_id,recipient,payload,created_by) SELECT x.id,\'campaign\',$2,x."user",x.email,x.payload,$3 FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,"user" text,email text,payload jsonb)',
      [JSON.stringify(jobs), dispatch, actor],
    );
    await emailAudit(client, actor, "email.campaign_dispatched", dispatch);
    return { id: dispatch, queued: jobs.length };
  });
}
export async function cancelDispatch(
  pool: Pool,
  actor: string,
  id: string,
  version: number,
) {
  return emailTransaction(pool, async (client) => {
    const row = (
      await client.query(
        "UPDATE tpa.email_dispatches SET cancelled_at=now(),version=version+1 WHERE id=$1 AND version=$2 AND cancelled_at IS NULL RETURNING *",
        [id, version],
      )
    ).rows[0];
    if (!row)
      throw new EmailOperationError("Dispatch changed. Reload first.", 409);
    await client.query(
      "UPDATE tpa.email_jobs SET status='cancelled',reason='staff_cancelled',updated_at=now() WHERE dispatch_id=$1 AND status='queued'",
      [id],
    );
    await emailAudit(client, actor, "email.dispatch_cancelled", id);
    return { saved: true };
  });
}
export async function unsubscribe(pool: Pool, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new EmailOperationError("Unsubscribe link is invalid.", 400);
  return emailTransaction(pool, async (client) => {
    const entry = (
      await client.query(
        "SELECT user_id FROM tpa.email_unsubscribe_tokens WHERE token_hash=$1",
        [tokenHash(token)],
      )
    ).rows[0];
    if (!entry)
      throw new EmailOperationError("Unsubscribe link is invalid.", 400);
    const old = (
      await client.query(
        "INSERT INTO tpa.newsletter_consents(user_id,subscribed,source) VALUES($1,false,'email_unsubscribe') ON CONFLICT(user_id) DO UPDATE SET subscribed=false,changed_at=now(),source='email_unsubscribe' WHERE tpa.newsletter_consents.subscribed=true RETURNING user_id",
        [entry.user_id],
      )
    ).rows[0];
    await client.query(
      "UPDATE tpa.email_jobs SET status='skipped',reason='consent_withdrawn',updated_at=now() WHERE user_id=$1 AND kind='campaign' AND status='queued'",
      [entry.user_id],
    );
    if (old)
      await client.query(
        "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES(NULL,'newsletter.email_unsubscribed',$1)",
        [entry.user_id],
      );
    return { unsubscribed: true };
  });
}
export async function queueReply(
  pool: Pool,
  actor: string,
  id: string,
  version: number,
  draftVersion: number,
) {
  if (!(await emailReadiness(pool)).enabled)
    throw new EmailOperationError(
      "Email worker is unavailable. Your reply draft is retained.",
      503,
    );
  return emailTransaction(pool, async (client) => {
    const row = (
      await client.query(
        "SELECT * FROM tpa.email_conversations WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) throw new EmailOperationError("Conversation not found.", 404);
    if (
      row.version !== version ||
      row.draft_version !== draftVersion ||
      row.archived
    )
      throw new EmailOperationError(
        "Conversation changed. Reload before replying.",
        409,
      );
    if (!row.draft.trim())
      throw new EmailOperationError("Save a reply draft first.");
    const recipient = emailAddress(row.reply_to);
    if (
      (
        await client.query(
          "SELECT 1 FROM tpa.email_suppressions WHERE email=$1",
          [recipient],
        )
      ).rowCount
    )
      throw new EmailOperationError(
        "This recipient is suppressed. No reply was queued.",
        409,
      );
    const parent = (
      await client.query(
        "SELECT message_id FROM tpa.email_messages WHERE conversation_id=$1 AND direction='incoming' ORDER BY created_at DESC,id LIMIT 1",
        [id],
      )
    ).rows[0];
    const job = randomUUID();
    await client.query(
      "INSERT INTO tpa.email_jobs(id,kind,conversation_id,draft_version,recipient,payload,created_by) VALUES($1,'reply',$2,$3,$4,$5,$6)",
      [
        job,
        id,
        draftVersion,
        recipient,
        {
          subject: row.subject.startsWith("Re: ")
            ? row.subject
            : `Re: ${row.subject}`,
          body: row.draft,
          parent: parent?.message_id ?? null,
          sender: inboxAddress,
        },
        actor,
      ],
    );
    await client.query(
      "UPDATE tpa.email_conversations SET version=version+1,updated_at=now(),status='in_progress' WHERE id=$1",
      [id],
    );
    await emailAudit(client, actor, "email.reply_queued", job);
    return { id: job, queued: true };
  });
}
