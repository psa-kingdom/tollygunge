import { getDatabase } from "./database";
import { rosterMatches } from "@/domain/event-roster";
import "server-only";
import { applyHistoricalEventDetails } from "./historical-event-details";
import ExcelJS from "exceljs";
import { access } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

export type WorkbookAttendee = { number: string; name: string; email: string; mobile: string; designation: string; organisation: string; status: "Attended" | "Not attended" | "Not recorded"; matched: boolean; plan?: string; registrationStatus?: string };
export type WorkbookEvent = { date: string; sheet: string; rows: WorkbookAttendee[]; title?: string; description?: string; location?: string; speakers?: string; version?: number; attendanceAvailable?: boolean };
const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const memberKey = (value: string) => value.trim().replace(/^0+(?=\d)/, "");
export async function loadWorkbookAttendance({ includeDeleted = false } = {}): Promise<WorkbookEvent[]> {
  const events = await applyHistoricalEventDetails(await readWorkbookAttendance(), includeDeleted);
  if (!process.env.DATABASE_URL) return events;
  const overrides = (await getDatabase().query("SELECT event_key,data FROM tpa.event_participant_overrides WHERE event_key=ANY($1::text[]) ORDER BY event_key,identity", [events.map(event=>event.date)])).rows;
  for (const override of overrides) {
    const event=events.find(event=>event.date===override.event_key);
    if (!event) continue;
    const data=override.data;
    const matches=event.rows.filter(row=>rosterMatches({name:row.name,email:row.email,number:row.number,phone:row.mobile},data));
    const previous=matches.length===1?matches[0]:undefined;
    const updated:WorkbookAttendee={
      number:data.number??previous?.number??"",name:data.name??previous?.name??"",
      email:data.email??previous?.email??"",mobile:data.phone??previous?.mobile??"",
      designation:previous?.designation??"",organisation:data.organisation??previous?.organisation??"",
      status:data.attendance??previous?.status??"Not recorded",matched:previous?.matched??false,
      plan:data.plan??previous?.plan,registrationStatus:data.registrationStatus??previous?.registrationStatus,
    };
    if(previous)event.rows[event.rows.indexOf(previous)]=updated;
    else if(!matches.length)event.rows.push(updated);
    event.attendanceAvailable=true;
  }
  return events;
}
async function readWorkbookAttendance(): Promise<WorkbookEvent[]> {
  // Private runtime configuration: never use a NEXT_PUBLIC variable for member data.
  const snapshot = process.env.TPA_ATTENDANCE_SNAPSHOT_GZIP_BASE64;
  if (snapshot) {
    const events: unknown = JSON.parse(gunzipSync(Buffer.from(snapshot, "base64"), { maxOutputLength: 2_000_000 }).toString("utf8"));
    if (!Array.isArray(events) || !events.every(event =>
      event && typeof event.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
      typeof event.sheet === "string" && Array.isArray(event.rows) && event.rows.every((row: WorkbookAttendee) =>
        row && [row.number, row.name, row.email, row.mobile, row.designation, row.organisation].every(value => typeof value === "string") &&
        typeof row.matched === "boolean" && ["Attended", "Not attended", "Not recorded"].includes(row.status)
      )
    )) throw Error("The private attendance snapshot is invalid.");
    return (events as WorkbookEvent[]).map(event => ({ ...event, attendanceAvailable: true }));
  }
  const filename = process.env.TPA_ATTENDANCE_WORKBOOK || path.join(process.cwd(), ".local/event-attendance/source.xlsx");
  try { await access(filename); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filename);
  const database = workbook.getWorksheet("Database");
  if (!database) throw Error("Attendance workbook is missing its Database sheet.");
  const members = new Map<string, ExcelJS.Row[]>();
  database.eachRow((row, index) => {
    if (index === 1) return;
    const key = memberKey(row.getCell(4).text);
    if (key) members.set(key, [...(members.get(key) || []), row]);
  });
  return workbook.worksheets.flatMap(sheet => {
    const match = /^(\d{2})-(\d{2})-(\d{2})$/.exec(sheet.name);
    if (!match) return [];
    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, index) => headers.set(normalize(cell.text), index));
    const rows: WorkbookAttendee[] = [];
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      const cell = (...names: string[]) => { const col = names.map(normalize).map(n => headers.get(n)).find(Boolean); return col ? row.getCell(col).text.trim() : ""; };
      const name = cell("Member Name", "Name");
      if (!name) return;
      const number = cell("Membership No.");
      const matches = members.get(memberKey(number)) || [];
      const member = matches.length === 1 ? matches[0] : undefined;
      const attendance = normalize(cell("Attendance Status", "Signature"));
      rows.push({ number, name: member ? [member.getCell(2).text, member.getCell(3).text].filter(Boolean).join(" ") : name,
        email: member?.getCell(5).text || cell("Email"), mobile: member?.getCell(6).text || cell("Mobile"),
        designation: member?.getCell(7).text || "", organisation: member?.getCell(8).text || "",
        status: ["attended", "yes", "present"].includes(attendance) ? "Attended" : ["notattended", "no", "absent"].includes(attendance) ? "Not attended" : "Not recorded", matched: Boolean(member) });
    });
    return [{ date: `20${match[3]}-${match[2]}-${match[1]}`, sheet: sheet.name, rows, attendanceAvailable: true }];
  }).sort((a, b) => b.date.localeCompare(a.date));
}
