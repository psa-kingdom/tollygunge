import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { record } from "../domain/operations";
import { emailAddress, inboxAddress, campaignAddress } from "../domain/email";
import { emailTransaction } from "./email-service";
export const resendEventTypes = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.failed",
  "email.bounced",
  "email.complained",
  "email.suppressed",
  "email.received",
] as const;
export async function recordEmailEvent(
  pool: Pool,
  eventId: string,
  value: unknown,
) {
  const event = record(value),
    data = record(event.data);
  if (
    typeof event.type !== "string" ||
    !resendEventTypes.includes(event.type as (typeof resendEventTypes)[number])
  )
    return { ignored: true };
  if (
    typeof data.email_id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(data.email_id) ||
    typeof event.created_at !== "string" ||
    !Number.isFinite(Date.parse(event.created_at))
  )
    throw Error("Invalid event.");
  const incoming = event.type === "email.received";
  const to = Array.isArray(data.to) ? data.to.map(emailAddress) : [];
  if (
    incoming
      ? !to.includes(inboxAddress)
      : ![
          inboxAddress,
          campaignAddress,
          "no-reply@updates.tpassociation.org",
        ].includes(emailAddress(data.from))
  )
    return { ignored: true };
  return emailTransaction(pool, async (client) => {
    const inserted = await client.query(
      "INSERT INTO tpa.email_events(event_id,provider_id,type,occurred_at) VALUES($1,$2,$3,$4) ON CONFLICT(event_id) DO NOTHING RETURNING event_id",
      [eventId, data.email_id, event.type, event.created_at],
    );
    if (!inserted.rowCount) return { duplicate: true };
    if (incoming)
      await client.query(
        "INSERT INTO tpa.email_jobs(id,kind,payload) VALUES($1,'inbound',$2) ON CONFLICT DO NOTHING",
        [randomUUID(), { emailId: data.email_id }],
      );
    else if (
      ["email.bounced", "email.complained", "email.suppressed"].includes(
        String(event.type),
      ) &&
      (event.type !== "email.bounced" ||
        (data.bounce as { type?: string } | undefined)?.type === "Permanent")
    ) {
      for (const email of to) {
        await client.query(
          "INSERT INTO tpa.email_suppressions(email,reason) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET reason=CASE WHEN tpa.email_suppressions.reason='complaint' THEN 'complaint' ELSE EXCLUDED.reason END",
          [
            email,
            event.type === "email.complained"
              ? "complaint"
              : event.type === "email.bounced"
                ? "bounce"
                : "suppressed",
          ],
        );
        await client.query(
          "UPDATE tpa.email_jobs SET status='skipped',reason='suppressed',updated_at=now() WHERE kind IN ('campaign','reply') AND recipient=$1 AND status='queued'",
          [email],
        );
      }
    }
    if (
      !incoming &&
      data.tags &&
      typeof data.tags === "object" &&
      !Array.isArray(data.tags)
    ) {
      const job = (data.tags as Record<string, unknown>).tpa_job;
      if (
        typeof job === "string" &&
        /^[a-f0-9-]{36}$/i.test(job) &&
        event.type !== "email.failed"
      )
        await client.query(
          "UPDATE tpa.email_jobs SET provider_id=coalesce(provider_id,$2),status='accepted',lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND recipient=ANY($3::text[]) AND (provider_id IS NULL OR provider_id=$2)",
          [job, data.email_id, to],
        );
    }
    return { recorded: true };
  });
}
