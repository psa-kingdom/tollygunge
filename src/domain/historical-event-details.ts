import { record, text, version } from "./operations";
// Event metadata can exist even when its separately stored register is missing.
// An available, genuinely empty register must still be distinguishable from it.
export function historicalAttendanceAvailable(event: { sheet: string; rows: readonly unknown[]; attendanceAvailable?: boolean }) {
  return event.attendanceAvailable ?? Boolean(event.sheet || event.rows.length);
}
export type HistoricalEventDetails = { title: string; description: string; location: string; speakers: string; version: number };
export function historicalEventInput(value: unknown) {
  const input = record(value);
  const date = text(input.date, "Event date", 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw Error("Choose a valid event date.");
  return {
    date, version: version(input.version),
    title: text(input.title, "Event title", 160, 3),
    description: text(input.description, "Description", 5000),
    location: text(input.location, "Venue", 240),
    speakers: text(input.speakers, "Speakers", 500),
    reason: text(input.reason, "Reason for editing", 1000, 3),
  };
}
