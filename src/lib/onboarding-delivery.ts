import type { Pool } from "pg";
import { openMail } from "./onboarding-mail";
import {
  providerRequest,
  fetchEmailQuota,
  EmailProviderError,
} from "./email-provider";
import { quotaPause } from "../domain/email";
export async function recordOnboardingEvent(
  pool: Pool,
  id: string,
  value: unknown,
) {
  if (process.env.ONBOARDING_ENABLED !== "true") return;
  const e = value as { type?: string; data?: { email_id?: string } };
  if (
    !e ||
    ![
      "email.sent",
      "email.delivered",
      "email.bounced",
      "email.complained",
      "email.failed",
      "email.suppressed",
    ].includes(e.type ?? "") ||
    typeof e.data?.email_id !== "string"
  )
    return;
  await pool.query(
    "INSERT INTO tpa.onboarding_mail_events(id,provider_id,type) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [id, e.data.email_id, e.type],
  );
  await reconcile(pool, e.data.email_id);
}
async function reconcile(pool: Pool, id: string) {
  await pool.query(
    "UPDATE tpa.onboarding_mail SET status=CASE WHEN EXISTS(SELECT 1 FROM tpa.onboarding_mail_events WHERE provider_id=$1 AND type IN ('email.bounced','email.complained','email.failed','email.suppressed')) THEN 'bounced' WHEN EXISTS(SELECT 1 FROM tpa.onboarding_mail_events WHERE provider_id=$1 AND type='email.delivered') THEN 'delivered' ELSE status END WHERE provider_id=$1",
    [id],
  );
}
export async function runOnboardingTick(
  pool: Pool,
  env: Record<string, string | undefined> = process.env,
  deps = { request: providerRequest, quota: fetchEmailQuota },
) {
  if (
    env.ONBOARDING_ENABLED !== "true" ||
    !env.RESEND_API_KEY ||
    env.RESEND_DOMAIN_VERIFIED !== "true" ||
    !env.RESEND_RECEIVING_API_KEY
  )
    return;
  await pool.query(
    "UPDATE tpa.onboarding_mail SET status='failed',reason='link_expired',lease_until=NULL WHERE status IN ('queued','leased') AND ((kind='recovery' AND created_at<now()-interval '15 minutes') OR (kind='verification' AND created_at<now()-interval '24 hours') OR (kind='invitation' AND created_at<now()-interval '48 hours'))",
  );
  await pool.query(
    "UPDATE tpa.onboarding_mail SET status='failed',reason='uncertain_send_expired' WHERE status IN ('queued','leased') AND first_attempt_at<now()-interval '23 hours'",
  );
  await pool.query(
    "UPDATE tpa.onboarding_mail SET status='failed',reason='retry_limit' WHERE status='leased' AND lease_until<now() AND attempts>=5",
  );
  const quota = await deps.quota(env.RESEND_RECEIVING_API_KEY);
  const pause = quotaPause(quota, "transactional");
  if (pause) return;
  const row = (
    await pool.query(
      "UPDATE tpa.onboarding_mail SET status='leased',lease_until=now()+interval '40 seconds',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()) WHERE id=(SELECT id FROM tpa.onboarding_mail WHERE (status='queued' OR status='leased' AND lease_until<now()) AND available_at<=now() AND attempts<5 ORDER BY CASE kind WHEN 'verification' THEN 0 WHEN 'invitation' THEN 1 ELSE 2 END,created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *",
    )
  ).rows[0];
  if (!row) return;
  try {
    if (
      (
        await pool.query(
          "SELECT 1 FROM tpa.email_suppressions WHERE email=$1",
          [row.recipient],
        )
      ).rowCount
    ) {
      await pool.query(
        "UPDATE tpa.onboarding_mail SET status='failed',reason='suppressed',lease_until=NULL WHERE id=$1",
        [row.id],
      );
      return;
    }
    const payload = openMail(row.payload, env.BETTER_AUTH_SECRET);
    const result = await deps.request(
      "/emails",
      env.RESEND_API_KEY,
      {
        from: env.AUTH_EMAIL_FROM || "TPA <no-reply@updates.tpassociation.org>",
        to: [row.recipient],
        ...payload,
      },
      "onboarding-" + row.id,
    );
    if (typeof result.id !== "string") throw Error("Invalid receipt");
    await pool.query(
      "UPDATE tpa.onboarding_mail SET status='accepted',provider_id=$2,lease_until=NULL,payload='{}'::jsonb WHERE id=$1",
      [row.id, result.id],
    );
    await reconcile(pool, result.id);
  } catch (e) {
    const permanent = e instanceof EmailProviderError && !e.transient;
    await pool.query(
      "UPDATE tpa.onboarding_mail SET status=CASE WHEN attempts>=5 OR $2 THEN 'failed' ELSE 'queued' END,reason=$3,available_at=now()+interval '1 minute'*power(2,attempts),lease_until=NULL WHERE id=$1",
      [
        row.id,
        permanent,
        e instanceof EmailProviderError ? e.code : "delivery_unavailable",
      ],
    );
  }
}
