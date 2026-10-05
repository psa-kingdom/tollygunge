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
    await authorized(request, "events:manage");
    const eventId = uuid(new URL(request.url).searchParams.get("eventId"));
    return (
      await getDatabase().query(
        'SELECT r.id,r.status,u.name,u.email,a.checked_in_at FROM tpa.event_registrations r JOIN public."user" u ON u.id=r.user_id LEFT JOIN tpa.event_attendance a ON a.registration_id=r.id WHERE r.event_id=$1 ORDER BY u.name LIMIT 10000',
        [eventId],
      )
    ).rows;
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "events:manage", true),
      input = record(await jsonBody(request, 2048)),
      id = uuid(input.registrationId);
    return transaction(async (client) => {
      // Use the same event lock as registration/cancellation before locking registration.
      const match = (
        await client.query(
          "SELECT event_id FROM tpa.event_registrations WHERE id=$1",
          [id],
        )
      ).rows[0];
      if (!match) throw new OperationError("Registration not found.", 404);
      const event = (
        await client.query("SELECT * FROM tpa.events WHERE id=$1 FOR UPDATE", [
          match.event_id,
        ])
      ).rows[0];
      const registration = (
        await client.query(
          "SELECT status FROM tpa.event_registrations WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (
        event.status !== "published" ||
        new Date(event.starts_at) > new Date() ||
        registration.status !== "registered"
      )
        throw new OperationError(
          "Check-in requires an active registration at a started event.",
          409,
        );
      const result = await client.query(
        "INSERT INTO tpa.event_attendance(registration_id,checked_in_by) VALUES($1,$2) ON CONFLICT(registration_id) DO NOTHING RETURNING *",
        [id, actor.id],
      );
      if (result.rowCount)
        await audit(client, actor.id, "attendance.checked_in", id);
      return {
        checkedIn: true,
        duplicate: !result.rowCount,
        learningHours: null,
      };
    });
  });
}
