import { editableEvent } from "@/lib/event-operations";
import { getDatabase } from "@/lib/database";
import {
  authorized,
  operation,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
import { uuid, version, text } from "@/domain/operations";
import { queueEventMail } from "@/lib/event-mail";
export async function GET(r: Request) {
  return operation(async () => {
    await authorized(r, "payments:manage");
    const eventValue=new URL(r.url).searchParams.get("eventId"), eventId=eventValue?uuid(eventValue):null;
    const state = new URL(r.url).searchParams.get("status") || "pending";
    if (
      !["all", "pending", "paid", "failed", "refunded", "cancelled"].includes(
        state,
      )
    )
      throw new OperationError("Choose a payment status.");
    return (
      await getDatabase().query(
        "SELECT r.*,coalesce((SELECT jsonb_agg(h ORDER BY h.created_at) FROM tpa.event_payment_history h WHERE h.registration_id=r.id),'[]'::jsonb) AS history,e.title,u.name,u.email,m.membership_number FROM tpa.event_registrations r JOIN tpa.events e ON e.id=r.event_id JOIN public.\"user\" u ON u.id=r.user_id LEFT JOIN tpa.people p ON p.user_id=u.id LEFT JOIN tpa.memberships m ON m.person_id=p.id WHERE ($2::uuid IS NULL OR r.event_id=$2) AND r.fee_paise>0 AND ($1='all' OR r.payment_status=$1) ORDER BY r.registered_at DESC LIMIT 250",
        [state,eventId],
      )
    ).rows;
  });
}
export async function POST(r: Request) {
  return operation(async () => {
    const actor = await authorized(r, "payments:manage", true),
      i = await jsonBody(r, 6000),
      id = uuid(i.id),
      expected = version(i.version);
    if (
      !["pending", "paid", "failed", "refunded", "cancelled"].includes(i.status)
    )
      throw new OperationError("Choose a payment status.");
    const reference = text(
        i.reference ?? "",
        "Payment reference",
        200,
        i.status === "paid" ? 3 : 0,
      ),
      note = text(i.note ?? "", "Verification note", 1000, 3);
    return transaction(async (c) => {
      const match = (
        await c.query(
          "SELECT event_id FROM tpa.event_registrations WHERE id=$1",
          [id],
        )
      ).rows[0];
      if (!match) throw new OperationError("Registration not found.", 404);
      const event = (
        await c.query("SELECT * FROM tpa.events WHERE id=$1 FOR UPDATE", [
          match.event_id,
        ])
      ).rows[0];
      editableEvent(event);
      const row = (
        await c.query(
          "SELECT * FROM tpa.event_registrations WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (row.version !== expected)
        throw new OperationError(
          "Payment changed. Reload before verifying.",
          409,
        );
      if (!row.fee_paise || row.payment_status === "not_required")
        throw new OperationError("No payment is required.", 409);
      const transitions: Record<string, string[]> = {
        pending: ["paid", "failed", "cancelled"],
        failed: ["pending", "paid", "cancelled"],
        paid: ["refunded"],
        refunded: [],
        cancelled: [],
      };
      if (!transitions[row.payment_status]?.includes(i.status))
        throw new OperationError(
          "This payment transition is not permitted.",
          409,
        );
      if (
        i.status === "paid" &&
        (row.status !== "registered" || event.status === "cancelled")
      )
        throw new OperationError(
          "A cancelled registration cannot be confirmed.",
          409,
        );
      await c.query(`INSERT INTO tpa.event_payment_history(registration_id,from_status,to_status,fee_paise,reference,note,actor_id,previous_reference,previous_note)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id,row.payment_status,i.status,row.fee_paise,reference,note,actor.id,row.payment_reference,row.payment_note]);
      await c.query(
        "UPDATE tpa.event_registrations SET payment_status=$2,status=CASE WHEN $2 IN ('refunded','cancelled') THEN 'cancelled' ELSE status END,payment_reference=$3,payment_note=$4,payment_updated_by=$5,payment_updated_at=now(),version=version+1 WHERE id=$1",
        [id, i.status, reference, note, actor.id],
      );
      await c.query('UPDATE tpa.events SET attendance_finalized_at=NULL,financial_reviewed_at=NULL WHERE id=$1',[event.id]);
      await audit(
        c,
        actor.id,
        `payment.${row.payment_status}_to_${i.status}`,
        id,
      );
      if (
        ["refunded", "cancelled"].includes(i.status) &&
        row.status === "registered"
      )
        await audit(c, actor.id, "registration.payment_cancelled", id);
      await queueEventMail(
        c,
        row.user_id,
        event.title,
        i.status,
        id + "-" + (row.version + 1),
      );
      return { saved: true };
    });
  });
}
