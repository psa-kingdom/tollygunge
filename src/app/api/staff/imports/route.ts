import { getDatabase } from "@/lib/database";
import { record, text } from "@/domain/operations";
import { historyPreview } from "@/domain/history-import";
import {
  operation,
  authorized,
  jsonBody,
  OperationError,
} from "@/lib/operation-api";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return operation(async () => {
    await authorized(request, "events:manage", true);
    const input = record(await jsonBody(request, 1100000));
    if (input.action !== "preview")
      throw new OperationError(
        "Import commit awaits confirmed historical mapping and provenance rules.",
        409,
      );
    const filename = text(input.filename, "Source filename", 200, 1),
      source = text(input.csv, "CSV", 1000000, 1),
      rows = historyPreview(source);
    const emails = [...new Set(rows.map((row) => row.email))],
      eventIds = [
        ...new Set(
          rows
            .filter((row) => !row.errors.includes("Invalid event identifier."))
            .map((row) => row.eventId),
        ),
      ];
    const users = (
      await getDatabase().query(
        'SELECT id,lower(email) AS email FROM public."user" WHERE lower(email)=ANY($1::text[])',
        [emails],
      )
    ).rows as { id: string; email: string }[];
    const events = (
      await getDatabase().query(
        "SELECT id,starts_at,ends_at FROM tpa.events WHERE id=ANY($1::uuid[])",
        [eventIds],
      )
    ).rows;
    const existing = (
      await getDatabase().query(
        "SELECT r.user_id,r.event_id,a.checked_in_at FROM tpa.event_registrations r LEFT JOIN tpa.event_attendance a ON a.registration_id=r.id WHERE r.event_id=ANY($1::uuid[]) AND r.user_id=ANY($2::text[])",
        [eventIds, users.map((user) => user.id)],
      )
    ).rows;
    for (const row of rows) {
      const matches = users.filter((user) => user.email === row.email);
      if (matches.length !== 1)
        row.errors.push(
          matches.length
            ? "Ambiguous identity; no merge will be attempted."
            : "No existing authentication identity for this email.",
        );
      const event = events.find((e) => e.id === row.eventId);
      if (!event) row.errors.push("Unknown event.");
      else if (
        Number.isFinite(new Date(row.attendedAt).getTime()) &&
        (new Date(row.attendedAt) < new Date(event.starts_at) ||
          new Date(row.attendedAt) > new Date(event.ends_at))
      )
        row.errors.push("Timestamp is outside the event window.");
      if (
        matches.length === 1 &&
        existing.some(
          (record) =>
            record.user_id === matches[0].id &&
            record.event_id === row.eventId &&
            record.checked_in_at,
        )
      )
        row.errors.push(
          "Attendance already exists; no duplicate will be created.",
        );
    }
    return {
      filename,
      rows,
      total: rows.length,
      valid: rows.filter((row) => !row.errors.length).length,
      commitEnabled: false,
      mapping:
        "email → existing authentication identity; event_id → existing event; attended_at → attendance timestamp",
      notice:
        "Preview only. Confirm historical mapping, source provenance and learning-hour policy before imports are enabled.",
    };
  });
}
