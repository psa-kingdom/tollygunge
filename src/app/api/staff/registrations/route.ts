import {
  authorized,
  operation,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
import { uuid, version } from "@/domain/operations";
import { queueEventMail } from "@/lib/event-mail";
export async function POST(r: Request) {
  return operation(async () => {
    const actor = await authorized(r, "events:manage", true),
      i = await jsonBody(r, 3000),
      id = uuid(i.id),
      expected = version(i.version);
    if (i.action !== "cancel")
      throw new OperationError("Choose cancel registration.");
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
      const row = (
        await c.query(
          "SELECT * FROM tpa.event_registrations WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (row.version !== expected || row.status === "cancelled")
        throw new OperationError("Registration changed. Reload.", 409);
      await c.query(
        "UPDATE tpa.event_registrations SET status='cancelled',payment_status=CASE WHEN payment_status IN ('paid','refunded','not_required') THEN payment_status ELSE 'cancelled' END,version=version+1 WHERE id=$1",
        [id],
      );
      await audit(c, actor.id, "registration.staff_cancelled", id);
      await queueEventMail(
        c,
        row.user_id,
        event.title,
        "registration_cancelled",
        id + "-" + (expected + 1),
      );
      return { saved: true };
    });
  });
}
