import "server-only";
import { getDatabase } from "./database";
export type PublicHistoricalEvent = { date: string; title: string; description: string; location: string; speakers: string };
// Deliberately read only event metadata, never the private attendance workbook.
export async function publicHistoricalEvents(month = ""): Promise<PublicHistoricalEvent[]> {
  if (!process.env.DATABASE_URL) return [];
  const db = getDatabase();
  if (!(await db.query("SELECT to_regclass('tpa.historical_event_details') AS relation")).rows[0].relation) return [];
  return (await db.query<PublicHistoricalEvent>("SELECT source_date::text AS date,title,description,location,speakers FROM tpa.historical_event_details WHERE deleted_at IS NULL AND source_date<=(now() AT TIME ZONE 'Asia/Kolkata')::date AND ($1::text='' OR to_char(source_date,'YYYY-MM')=$1) ORDER BY source_date DESC", [month])).rows;
}
