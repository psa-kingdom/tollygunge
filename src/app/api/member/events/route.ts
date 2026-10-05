import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";
import { record, uuid } from "@/domain/operations";
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
        "SELECT e.id,e.title,e.location,e.starts_at,e.ends_at,e.status,r.id AS registration_id,r.status AS registration_status,a.checked_in_at FROM tpa.events e LEFT JOIN tpa.event_registrations r ON r.event_id=e.id AND r.user_id=$1 LEFT JOIN tpa.event_attendance a ON a.registration_id=r.id WHERE e.status='published' OR r.id IS NOT NULL ORDER BY e.starts_at DESC LIMIT 200",
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
    if (!["register", "cancel"].includes(String(input.action)))
      throw new OperationError("Invalid registration action.");
    return transaction(async (client) => {
      const event = (
        await client.query("SELECT * FROM tpa.events WHERE id=$1 FOR UPDATE", [
          eventId,
        ])
      ).rows[0];
      if (
        !event ||
        event.status !== "published" ||
        new Date(event.starts_at) <= new Date()
      )
        throw new OperationError("Registration is closed.", 409);
      const existing = (
        await client.query(
          "SELECT * FROM tpa.event_registrations WHERE event_id=$1 AND user_id=$2",
          [eventId, actor.id],
        )
      ).rows[0];
      if (input.action === "cancel") {
        if (!existing) throw new OperationError("Registration not found.", 404);
        await client.query(
          "UPDATE tpa.event_registrations SET status='cancelled' WHERE id=$1",
          [existing.id],
        );
        await audit(client, actor.id, "registration.cancelled", existing.id);
        return { status: "cancelled" };
      }
      if (existing?.status === "registered") return existing;
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
          "INSERT INTO tpa.event_registrations(id,event_id,user_id,status) VALUES($1,$2,$3,'registered') ON CONFLICT(event_id,user_id) DO UPDATE SET status='registered',registered_at=now() RETURNING *",
          [randomUUID(), eventId, actor.id],
        )
      ).rows[0];
      await audit(client, actor.id, "registration.created", row.id);
      return row;
    });
  });
}
