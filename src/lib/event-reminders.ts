import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { sealMail } from "./onboarding-mail";
import { eventEmail } from "../domain/event-email";

// Schedules are persisted even when delivery is paused; every worker operation is idempotent.
export async function scheduleEventReminders(pool: Pool, now = new Date(), env = process.env) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`INSERT INTO tpa.event_reminders(event_id,registration_id,schedule_revision,booking_revision,offset_minutes,audience,due_at)
      SELECT e.id,r.id,e.schedule_revision,r.booking_revision,o.value::int,a.audience,e.starts_at-make_interval(mins=>o.value::int)
      FROM tpa.events e JOIN tpa.event_registrations r ON r.event_id=e.id
      CROSS JOIN LATERAL jsonb_array_elements_text(e.reminders->'offsets') o
      CROSS JOIN (VALUES ('confirmed'),('pending')) a(audience)
      WHERE e.status='published' AND e.starts_at>$1 AND r.status='registered' AND (e.reminders->>'enabled')::boolean
        AND (a.audience='confirmed' OR (e.reminders->>'includePending')::boolean)
      ON CONFLICT DO NOTHING`, [now]);
    const rows = (await c.query(`SELECT d.*,row_to_json(e) AS event,row_to_json(r) AS registration,u.email
      FROM tpa.event_reminders d JOIN tpa.events e ON e.id=d.event_id JOIN tpa.event_registrations r ON r.id=d.registration_id
      JOIN public."user" u ON u.id=r.user_id LEFT JOIN tpa.onboarding_mail m ON m.id=d.mail_id WHERE
      (d.status='scheduled' OR (d.status='queued' AND m.status IN ('queued','leased'))) AND
      ((d.status='scheduled' AND d.due_at<=$1) OR e.status<>'published' OR r.status<>'registered'
        OR d.schedule_revision<>e.schedule_revision OR d.booking_revision<>r.booking_revision OR NOT (e.reminders->>'enabled')::boolean
        OR e.starts_at<=$1 OR d.due_at+interval '15 minutes'<$1
        OR (d.status='queued' AND ((d.audience='confirmed' AND r.payment_status NOT IN ('paid','not_required')) OR (d.audience='pending' AND r.payment_status<>'pending'))))
      ORDER BY d.due_at FOR UPDATE OF d SKIP LOCKED LIMIT 500`, [now])).rows;
    for (const d of rows) {
      const reason = ineligible(d, now, d.due_at <= now);
      if (reason) {
        await skip(c, d, reason);
        continue;
      }
      if (d.status !== "scheduled" || d.due_at > now) continue;
      const mailId = randomUUID();
      const payload = sealMail(eventEmail(d.event, `reminder_${d.audience}`, env.BETTER_AUTH_URL!, d.registration), env.BETTER_AUTH_SECRET);
      const mail = (await c.query(`INSERT INTO tpa.onboarding_mail(id,dedupe,user_id,recipient,kind,payload,event_id,registration_id)
        VALUES($1,$2,$3,$4,'event_reminder',$5,$6,$7) ON CONFLICT(dedupe) DO UPDATE SET dedupe=EXCLUDED.dedupe RETURNING id`,
      [mailId, `event-reminder-${d.registration_id}-${d.booking_revision}-${d.schedule_revision}-${d.offset_minutes}-${d.audience}`, d.registration.user_id, d.email, payload, d.event_id, d.registration_id])).rows[0];
      await c.query("UPDATE tpa.event_reminders SET status='queued',mail_id=$2 WHERE id=$1", [d.id, mail.id]);
    }
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK"); throw e; }
  finally { c.release(); }
}
async function reminderContext(c: PoolClient, id: string) {
  return (await c.query(`SELECT d.*,row_to_json(e) AS event,row_to_json(r) AS registration,u.email
    FROM tpa.event_reminders d JOIN tpa.events e ON e.id=d.event_id
    JOIN tpa.event_registrations r ON r.id=d.registration_id JOIN public."user" u ON u.id=r.user_id WHERE d.id=$1`, [id])).rows[0];
}
type Context = Awaited<ReturnType<typeof reminderContext>>;
function ineligible(d: Context, now: Date, checkAudience: boolean): string | null {
  if (d.event.status !== "published") return "event_unavailable";
  if (d.registration.status !== "registered") return "registration_cancelled";
  if (d.registration.booking_revision !== d.booking_revision) return "booking_changed";
  if (d.event.schedule_revision !== d.schedule_revision || !d.event.reminders.enabled || !d.event.reminders.offsets.includes(d.offset_minutes) || (d.audience === "pending" && !d.event.reminders.includePending)) return "schedule_changed";
  if (new Date(d.event.starts_at) <= now) return "event_started";
  if (now.getTime() > new Date(d.due_at).getTime() + 15 * 60000) return "reminder_expired";
  if (checkAudience && !(d.audience === "confirmed" ? ["paid", "not_required"].includes(d.registration.payment_status) : d.registration.payment_status === "pending")) return "payment_changed";
  return null;
}
async function skip(c: PoolClient, d: Context, reason: string) {
  // Accepted messages remain historical evidence even if the event later changes.
  if (d.mail_id) {
    const result = await c.query("UPDATE tpa.onboarding_mail SET status='failed',reason=$2,lease_until=NULL WHERE id=$1 AND status IN ('queued','leased') RETURNING id", [d.mail_id, reason]);
    if (!result.rowCount) return;
  }
  await c.query("UPDATE tpa.event_reminders SET status='skipped',reason=$2 WHERE id=$1", [d.id, reason]);
}
// Hold event/registration locks across the send so cancellation/payment writes cannot race eligibility.
export async function deliverEventReminder(pool: Pool, mailId: string, send: (c: PoolClient) => Promise<void>, now = new Date()) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const match = (await c.query("SELECT * FROM tpa.event_reminders WHERE mail_id=$1", [mailId])).rows[0];
    if (!match) { await c.query("UPDATE tpa.onboarding_mail SET status='failed',reason='reminder_missing',lease_until=NULL WHERE id=$1", [mailId]); await c.query("COMMIT"); return; }
    await c.query("SELECT id FROM tpa.events WHERE id=$1 FOR SHARE", [match.event_id]);
    await c.query("SELECT id FROM tpa.event_registrations WHERE id=$1 FOR SHARE", [match.registration_id]);
    await c.query("SELECT id FROM tpa.event_reminders WHERE id=$1 FOR UPDATE", [match.id]);
    const mail = (await c.query("SELECT status FROM tpa.onboarding_mail WHERE id=$1 FOR UPDATE", [mailId])).rows[0];
    if (!mail || !["queued","leased"].includes(mail.status)) { await c.query("COMMIT"); return; }
    const d = await reminderContext(c, match.id), reason = ineligible(d, now, true);
    if (reason || d.status !== "queued") await skip(c, d, reason ?? "reminder_obsolete");
    else await send(c);
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK"); throw e; }
  finally { c.release(); }
}
