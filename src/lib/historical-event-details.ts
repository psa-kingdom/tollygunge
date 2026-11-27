import "server-only";
import { getDatabase } from "./database";
import type { WorkbookEvent } from "./workbook-attendance";
import type { HistoricalEventDetails } from "@/domain/historical-event-details";
export async function applyHistoricalEventDetails(events: WorkbookEvent[]): Promise<WorkbookEvent[]> {
  if (!process.env.DATABASE_URL) return events;
  const db = getDatabase();
  // Older deployments remain readable before the additive migration is applied.
  if (!(await db.query("SELECT to_regclass('tpa.historical_event_details') AS relation")).rows[0].relation) return events;
  const details = (await db.query<HistoricalEventDetails & { date: string }>("SELECT source_date::text AS date,title,description,location,speakers,version FROM tpa.historical_event_details")).rows;
  const byDate = new Map(details.map(row => [row.date, row]));
  const known = new Set(events.map(event => event.date));
  const allEvents = [...events, ...details.filter(detail => !known.has(detail.date)).map(detail => ({date: detail.date, sheet: "", rows: [], attendanceAvailable: false}))];
  return allEvents.map(event => {
    const detail = byDate.get(event.date);
    return detail ? { ...event, title: detail.title, description: detail.description, location: detail.location, speakers: detail.speakers, version: detail.version } : event;
  }).sort((a, b) => b.date.localeCompare(a.date));
}
