import "server-only";
import type { PoolClient } from "pg";
import { validEventDate } from "@/domain/event-date-range";
import { getDatabase } from "./database";
import { loadWorkbookAttendance } from "./workbook-attendance";

const historicalFinancePrefix = "00000000-0000-5000-8000-0000";

export function historicalFinanceDate(id: string) {
  if (!id.startsWith(historicalFinancePrefix)) return "";
  const date = id.slice(historicalFinancePrefix.length);
  return validEventDate(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`);
}

export async function historicalFinanceEvents(date = "") {
  const events = await loadWorkbookAttendance();
  return events.filter((event) => !date || event.date === date).map((event) => ({
    id: historicalFinancePrefix + event.date.replaceAll("-", ""),
    date: event.date,
    title: event.title || "Association event",
    location: event.location || "",
    starts_at: `${event.date}T12:00:00+05:30`,
    ends_at: `${event.date}T13:00:00+05:30`,
    status: "historical",
    participant_count: event.rows.length,
    completed_at: null,
    archived_at: null,
  }));
}

export async function financeEventExists(id: string) {
  const date = historicalFinanceDate(id);
  if (date) return (await historicalFinanceEvents(date)).some((event) => event.id === id);
  return Boolean((await getDatabase().query("SELECT 1 FROM tpa.events WHERE id=$1", [id])).rowCount);
}

export async function ensureHistoricalFinanceEvent(
  client: PoolClient,
  actorId: string,
  event: Awaited<ReturnType<typeof historicalFinanceEvents>>[number],
) {
  // The operational row supplies the finance foreign key. The workbook remains
  // the source of the event's title, date, venue and participant register.
  await client.query(
    `INSERT INTO tpa.events(id,title,description,location,starts_at,ends_at,capacity,updated_by,booking_closed,historical_finance_date)
     VALUES($1,$2,'',$3,$4,$5,1,$6,true,$7)
     ON CONFLICT (id) DO NOTHING`,
    [event.id, event.title.slice(0, 160), event.location.slice(0, 200), event.starts_at, event.ends_at, actorId, event.date],
  );
}
