import { createHmac, randomInt, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { queueOnboardingMail } from "./onboarding-mail";

function digest(email: string, code: string, secret: string) {
  return createHmac("sha256", secret)
    .update("registration:" + email + ":" + code)
    .digest("hex");
}

export async function issueRegistrationCode(
  client: PoolClient,
  email: string,
  secret: string,
) {
  // Bound code delivery across addresses as well as for one recipient.
  await client.query("SELECT pg_advisory_xact_lock(644881913)");
  const {
    rows: [limits],
  } = await client.query(
    `SELECT count(*) FILTER (WHERE created_at > now()-interval '1 minute')::int AS recent,
            count(*) FILTER (WHERE recipient=$1)::int AS recipient
       FROM tpa.onboarding_mail
      WHERE dedupe LIKE 'signup-code-%' AND created_at > now()-interval '1 hour'`,
    [email],
  );
  if (limits.recent >= 30 || limits.recipient >= 5) return;
  const existing = await client.query(
    `SELECT 1 FROM public."user" WHERE lower(email)=$1
     UNION ALL SELECT 1 FROM tpa.people WHERE user_id IS NULL AND lower(btrim(contact_email))=$1`,
    [email],
  );
  if (existing.rowCount) return;
  const code = String(randomInt(1_000_000)).padStart(6, "0");
  const written = await client.query(
    `INSERT INTO tpa.registration_codes(email,digest,expires_at) VALUES($1,$2,now()+interval '10 minutes')
     ON CONFLICT(email) DO UPDATE SET digest=excluded.digest,expires_at=excluded.expires_at,sent_at=now(),attempts=0
     WHERE tpa.registration_codes.sent_at < now()-interval '1 minute'`,
    [email, digest(email, code, secret)],
  );
  if (written.rowCount) {
    await queueOnboardingMail(
      client,
      null,
      email,
      "verification",
      code,
      "signup-code-" + randomUUID(),
    );
  }
}

export async function consumeRegistrationCode(
  database: Pool,
  email: string,
  code: unknown,
  secret: string,
) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  const {
    rows: [result],
  } = await database.query(
    `UPDATE tpa.registration_codes
     SET attempts=attempts+1, expires_at=CASE WHEN digest=$2 THEN now() ELSE expires_at END
     WHERE email=$1 AND expires_at>now() AND attempts<5
     RETURNING digest=$2 AS matched`,
    [email, digest(email, code, secret)],
  );
  return result?.matched === true;
}
