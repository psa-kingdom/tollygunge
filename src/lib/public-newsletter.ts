import { randomUUID, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { emailAddress, tokenHash } from "../domain/email";
import { newsletterConsentVersion, subscriptionRequested, subscriptionToken } from "../domain/newsletter";
import { sealMail } from "./onboarding-mail";
import { emailTransaction, EmailOperationError } from "./email-service";

export async function publicUnsubscribeToken(client: PoolClient, id: string, version: number) {
  const token = randomBytes(32).toString("base64url");
  await client.query("INSERT INTO tpa.public_subscription_tokens(token_hash,subscriber_id,purpose,subscriber_version) VALUES($1,$2,'unsubscribe',$3)", [tokenHash(token), id, version]);
  return token;
}

export async function requestPublicSubscription(pool: Pool, input: Record<string, unknown>, env: Record<string,string|undefined> = process.env) {
  let email: string;
  try {
    email = emailAddress(input.email);
    if (typeof input.email !== "string" || email !== input.email.trim().toLowerCase() || input.consent !== true || String(input.website ?? "")) throw Error();
  } catch { throw new EmailOperationError("Enter a valid email address and agree to receive newsletters and event announcements."); }
  if (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL) throw new EmailOperationError("Subscriptions are temporarily unavailable. Please try again later.", 503);
  const origin = new URL(env.BETTER_AUTH_URL).origin;
  const response = { requested: true, message: subscriptionRequested };
  return emailTransaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(74672035)");
    const quota = (await client.query("SELECT count(*) FILTER(WHERE email=$1 AND requested_at>now()-interval '1 day')::int AS address,count(*) FILTER(WHERE requested_at>now()-interval '1 hour')::int AS total,bool_or(email=$1 AND requested_at>now()-interval '60 seconds') AS recent FROM tpa.public_subscription_requests WHERE requested_at>now()-interval '1 day'", [email])).rows[0];
    if (quota.address >= 3 || quota.total >= 100 || quota.recent) return response;
    await client.query("INSERT INTO tpa.public_subscription_requests(email) VALUES($1)", [email]);
    if ((await client.query("SELECT 1 FROM tpa.email_suppressions WHERE email=$1", [email])).rowCount) return response;
    const existing = (await client.query("SELECT * FROM tpa.public_subscribers WHERE email=$1 FOR UPDATE", [email])).rows[0];
    if (existing?.status === "confirmed") return response;
    const row = existing
      ? (await client.query("UPDATE tpa.public_subscribers SET status='pending',version=version+1,requested_at=now(),consent_version=$2,updated_at=now() WHERE id=$1 RETURNING *", [existing.id, newsletterConsentVersion])).rows[0]
      : (await client.query("INSERT INTO tpa.public_subscribers(id,email,status,consent_version) VALUES($1,$2,'pending',$3) RETURNING *", [randomUUID(), email, newsletterConsentVersion])).rows[0];
    await client.query("UPDATE tpa.email_jobs SET status='cancelled',reason='subscription_replaced',updated_at=now() WHERE subscriber_id=$1 AND kind='subscription_confirmation' AND status='queued'", [row.id]);
    const token = randomBytes(32).toString("base64url"), hash = tokenHash(token);
    await client.query("INSERT INTO tpa.public_subscription_tokens(token_hash,subscriber_id,purpose,subscriber_version,expires_at) VALUES($1,$2,'confirm',$3,now()+interval '24 hours')", [hash, row.id, row.version]);
    const link = `${origin}/newsletter/confirm#token=${token}`;
    const body = `Confirm your request to receive TPA newsletters and public event announcements.\n\nOpen this link and choose Confirm subscription. The link expires in 24 hours.\n\n${link}\n\nIf you did not request this, ignore this email. No account or membership has been created.`;
    await client.query("INSERT INTO tpa.email_jobs(id,kind,subscriber_id,recipient,payload) VALUES($1,'subscription_confirmation',$2,$3,$4)", [randomUUID(), row.id, email, { subject: "Confirm your TPA subscription", sealedBody: sealMail(body, env.BETTER_AUTH_SECRET), tokenHash: hash, subscriptionVersion: row.version }]);
    return response;
  });
}

export async function confirmPublicSubscription(pool: Pool, value: unknown) {
  let token: string;
  try { token = subscriptionToken(value); } catch(e) { throw new EmailOperationError((e as Error).message); }
  return emailTransaction(pool, async client => {
    const item = (await client.query("SELECT * FROM tpa.public_subscription_tokens WHERE token_hash=$1 AND purpose='confirm'", [tokenHash(token)])).rows[0];
    if (!item) throw new EmailOperationError("This confirmation link is invalid or expired. Subscribe again for a new link.", 410);
    const row = (await client.query("SELECT * FROM tpa.public_subscribers WHERE id=$1 FOR UPDATE", [item.subscriber_id])).rows[0];
    if (item.used_at || new Date(item.expires_at).getTime() <= Date.now() || row.status !== 'pending' || row.version !== item.subscriber_version) throw new EmailOperationError("This confirmation link is invalid or expired. Subscribe again for a new link.", 410);
    await client.query("UPDATE tpa.public_subscribers SET status='confirmed',confirmed_at=now(),unsubscribed_at=NULL,updated_at=now() WHERE id=$1", [row.id]);
    await client.query("UPDATE tpa.public_subscription_tokens SET used_at=now() WHERE token_hash=$1", [tokenHash(token)]);
    await client.query("UPDATE tpa.email_jobs SET status='cancelled',reason='subscription_confirmed',updated_at=now() WHERE subscriber_id=$1 AND kind='subscription_confirmation' AND status='queued'", [row.id]);
    return { confirmed: true };
  });
}

export async function unsubscribePublicSubscription(pool: Pool, value: unknown) {
  let token: string;
  try { token = subscriptionToken(value); } catch(e) { throw new EmailOperationError((e as Error).message); }
  return emailTransaction(pool, async client => {
    const item = (await client.query("SELECT subscriber_id FROM tpa.public_subscription_tokens WHERE token_hash=$1 AND purpose='unsubscribe'", [tokenHash(token)])).rows[0];
    if (!item) throw new EmailOperationError("This unsubscribe link is invalid.", 400);
    await client.query("SELECT id FROM tpa.public_subscribers WHERE id=$1 FOR UPDATE", [item.subscriber_id]);
    await client.query("UPDATE tpa.public_subscribers SET status='unsubscribed',version=version+1,unsubscribed_at=now(),updated_at=now() WHERE id=$1 AND status<>'unsubscribed'", [item.subscriber_id]);
    await client.query("UPDATE tpa.email_jobs SET status='cancelled',reason='public_unsubscribed',updated_at=now() WHERE subscriber_id=$1 AND status='queued'", [item.subscriber_id]);
    return { unsubscribed: true };
  });
}
