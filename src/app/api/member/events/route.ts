import { queueEventMail } from "@/lib/event-mail";
import { registerEvent, registrationDetails, registrationRequest } from "@/lib/event-registration";
import { paymentProofTransaction } from "@/lib/finance-upload";
import { getDatabase } from "@/lib/database";
import { uuid } from "@/domain/operations";
import {
  operation,
  authorized,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request);
    return (
      await getDatabase().query(
        "SELECT (e.status='published' AND e.starts_at>now() AND e.completed_at IS NULL AND e.archived_at IS NULL AND EXISTS(SELECT 1 FROM tpa.event_banners b WHERE b.event_id=e.id)) AS has_banner,e.booking_closed,e.completed_at,e.archived_at,e.attendance_finalized_at,e.id,e.title,e.location,e.starts_at,e.ends_at,e.status,e.fee_paise,e.speakers,e.description,e.registration_starts_at,e.registration_ends_at,r.fee_paise AS registration_fee_paise,coalesce(a.outcome,'unmarked') AS attendance_status,r.payment_status,r.id AS registration_id,r.status AS registration_status,CASE WHEN a.outcome='attended' THEN a.checked_in_at END AS checked_in_at,a.outcome,r.fee_paise AS booked_fee_paise,r.payment_reference,r.version AS registration_version,e.completed_at,(SELECT awarded_at FROM tpa.event_badges b WHERE b.registration_id=r.id AND b.revoked_at IS NULL) AS badge_awarded_at FROM tpa.events e LEFT JOIN tpa.event_registrations r ON r.event_id=e.id AND r.user_id=$1 LEFT JOIN tpa.event_attendance a ON a.registration_id=r.id WHERE (e.status='published' AND (e.visibility='public' OR EXISTS(SELECT 1 FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id WHERE p.user_id=$1 AND m.status='active' AND m.type IS DISTINCT FROM 'Free' AND (m.valid_from IS NULL OR m.valid_from<=current_date) AND (m.valid_until IS NULL OR m.valid_until>=current_date)))) OR r.id IS NOT NULL ORDER BY e.starts_at DESC LIMIT 200",
        [actor.id],
      )
    ).rows;
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, undefined, true);
    const { input, file, payNow } = await registrationRequest(request);
    const eventId = uuid(input.eventId);
    if (!["register", "cancel", "payment_reference"].includes(String(input.action)))
      throw new OperationError("Invalid registration action.");
    if (input.action === "payment_reference")
      throw new OperationError("Submit a receipt with payment proof from your event page.", 409);
    if (input.action === "register") {
      if ((actor.plan === "Free" || input.details !== undefined || payNow) && !actor.emailVerified)
        throw new OperationError("Verify your email before registering.", 403);
      return paymentProofTransaction(file, payNow, async (client, attach) => {
        const result = await registerEvent(client, actor.id, eventId,
          input.details === undefined ? null : registrationDetails(input.details), false, payNow ? attach : undefined);
        return { ...result.registration, alreadyRegistered: !result.created };
      });
    }
    if (payNow) throw new OperationError("Choose a registration action for this payment.");
    return transaction(async client => {
      const event = (await client.query("SELECT * FROM tpa.events WHERE id=$1 FOR UPDATE", [eventId])).rows[0];
      if (!event || event.completed_at || event.archived_at || event.status !== "published" || new Date(event.starts_at).getTime() <= Date.now())
        throw new OperationError("Registration is closed.", 409);
      const existing = (await client.query("SELECT * FROM tpa.event_registrations WHERE event_id=$1 AND user_id=$2", [eventId, actor.id])).rows[0];
      if (!existing) throw new OperationError("Registration not found.", 404);
      if (existing.status === "cancelled") return { status: "cancelled" };
      await client.query("UPDATE tpa.event_registrations SET status='cancelled',version=version+1,payment_status=CASE WHEN payment_status IN ('paid','refunded','not_required') THEN payment_status ELSE 'cancelled' END WHERE id=$1", [existing.id]);
      await queueEventMail(client, actor.id, event.title, "registration_cancelled", existing.id + "-" + (existing.version + 1));
      await audit(client, actor.id, "registration.cancelled", existing.id);
      return { status: "cancelled" };
    });
  });
}
