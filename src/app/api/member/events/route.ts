import { queueEventMail } from "@/lib/event-mail";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";
import { record, uuid, text, version } from "@/domain/operations";
import {
  operation,
  authorized,
  jsonBody,
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
        "SELECT e.booking_closed,e.completed_at,e.archived_at,e.attendance_finalized_at,e.id,e.title,e.location,e.starts_at,e.ends_at,e.status,e.fee_paise,e.speakers,e.description,e.registration_starts_at,e.registration_ends_at,r.fee_paise AS registration_fee_paise,coalesce(a.outcome,'unmarked') AS attendance_status,r.payment_status,r.id AS registration_id,r.status AS registration_status,CASE WHEN a.outcome='attended' THEN a.checked_in_at END AS checked_in_at,a.outcome,r.fee_paise AS booked_fee_paise,r.payment_reference,r.version AS registration_version,e.completed_at,(SELECT awarded_at FROM tpa.event_badges b WHERE b.registration_id=r.id AND b.revoked_at IS NULL) AS badge_awarded_at FROM tpa.events e LEFT JOIN tpa.event_registrations r ON r.event_id=e.id AND r.user_id=$1 LEFT JOIN tpa.event_attendance a ON a.registration_id=r.id WHERE (e.status='published' AND (e.visibility='public' OR EXISTS(SELECT 1 FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id WHERE p.user_id=$1 AND m.status='active' AND (m.valid_from IS NULL OR m.valid_from<=current_date) AND (m.valid_until IS NULL OR m.valid_until>=current_date)))) OR r.id IS NOT NULL ORDER BY e.starts_at DESC LIMIT 200",
        [actor.id],
      )
    ).rows;
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, undefined, true),
      input = record(await jsonBody(request, 2048)),
      eventId = uuid(input.eventId);
    if (!["register", "cancel", "payment_reference"].includes(String(input.action)))
      throw new OperationError("Invalid registration action.");
    return transaction(async (client) => {
      const event = (
        await client.query("SELECT * FROM tpa.events WHERE id=$1 FOR UPDATE", [
          eventId,
        ])
      ).rows[0];
      if(input.action === "payment_reference") {
        if(!event || event.completed_at || event.archived_at || event.status!=="published") throw new OperationError("Event is closed for changes.",409);
        const reference=text(input.reference,"Payment reference",200,3);
        const result=await client.query("UPDATE tpa.event_registrations SET payment_reference=$3,version=version+1 WHERE event_id=$1 AND user_id=$2 AND version=$4 AND status='registered' AND payment_status IN ('pending','failed') RETURNING id",[eventId,actor.id,reference,version(input.version)]);
        if(!result.rowCount) throw new OperationError("Registration changed or does not await payment. Reload.",409);
        await audit(client,actor.id,"payment.reference_submitted",result.rows[0].id);
        return {saved:true};
      }
      if (
        !event || event.completed_at || event.archived_at ||
        event.status !== "published" || event.completed_at ||
        new Date(event.starts_at) <= new Date()
      )
        throw new OperationError("Registration is closed.", 409);
      if (input.action === "register") {
        if(event.booking_closed) throw new OperationError("Registration is closed.",409);
        if (
          (event.registration_starts_at &&
            new Date(event.registration_starts_at) > new Date()) ||
          (event.registration_ends_at &&
            new Date(event.registration_ends_at) <= new Date())
        )
          throw new OperationError(
            "Registration is outside the booking window.",
            409,
          );
        if (
          event.visibility === "members" &&
          !(
            await client.query(
              "SELECT 1 FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id WHERE p.user_id=$1 AND m.status='active' AND (m.valid_from IS NULL OR m.valid_from<=current_date) AND (m.valid_until IS NULL OR m.valid_until>=current_date)",
              [actor.id],
            )
          ).rowCount
        )
          throw new OperationError(
            "This event requires active membership.",
            403,
          );
      }
      const existing = (
        await client.query(
          "SELECT * FROM tpa.event_registrations WHERE event_id=$1 AND user_id=$2",
          [eventId, actor.id],
        )
      ).rows[0];
      if (input.action === "cancel") {
        if (!existing) throw new OperationError("Registration not found.", 404);
        if (existing.status === "cancelled") return { status: "cancelled" };
        await client.query(
          "UPDATE tpa.event_registrations SET status='cancelled',version=version+1,payment_status=CASE WHEN payment_status IN ('paid','refunded','not_required') THEN payment_status ELSE 'cancelled' END WHERE id=$1",
          [existing.id],
        );
        await queueEventMail(client, actor.id, event.title, "registration_cancelled", existing.id + "-" + (existing.version + 1));
        await audit(client, actor.id, "registration.cancelled", existing.id);
        return { status: "cancelled" };
      }
      if (existing?.status === "registered") return existing;
      if (["paid", "refunded"].includes(existing?.payment_status))
        throw new OperationError(
          "A paid cancellation requires staff review before rebooking.",
          409,
        );
      const count = (
        await client.query(
          "SELECT count(*)::int AS n FROM tpa.event_registrations WHERE event_id=$1 AND status='registered'",
          [eventId],
        )
      ).rows[0].n;
      if (count >= event.capacity)
        throw new OperationError("This event is full.", 409);
      const row = (
        await client.query(
          "INSERT INTO tpa.event_registrations(id,event_id,user_id,status,fee_paise,payment_status,payment_revision) VALUES($1,$2,$3,'registered',$4,$5,$6) ON CONFLICT(event_id,user_id) DO UPDATE SET status='registered',booking_revision=tpa.event_registrations.booking_revision+1,registered_at=now(),fee_paise=$4,payment_status=$5,payment_reference='',payment_note='',payment_revision=$6,version=tpa.event_registrations.version+1 RETURNING *",
          [
            randomUUID(),
            eventId,
            actor.id,
            event.fee_paise,
            event.fee_paise ? "pending" : "not_required",
            event.payment_revision,
          ],
        )
      ).rows[0];
      await client.query('INSERT INTO tpa.event_booking_payment_configurations(registration_id,booking_revision,event_id,payment_revision,fee_paise) VALUES($1,$2,$3,$4,$5)',[row.id,row.booking_revision,eventId,row.payment_revision,row.fee_paise]);
      await queueEventMail(
        client,
        actor.id,
        event.title,
        row.payment_status,
        row.id + "-" + row.version,
      );
      await audit(client, actor.id, "registration.created", row.id);
      return row;
    });
  });
}
