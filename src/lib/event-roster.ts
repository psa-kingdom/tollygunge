import "server-only";
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { loadWorkbookAttendance } from "./workbook-attendance";
import { rosterMatches, type RosterRow } from "@/domain/event-roster";
import { OperationError } from "./operation-error";

type DB = Pick<Pool | PoolClient, "query">;

export function rosterFingerprint(rows: RosterRow[]) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

export async function eventRoster(
  db: DB,
  eventKey: string,
): Promise<RosterRow[]> {
  let rows: RosterRow[];
  if (/^\d{4}-\d{2}-\d{2}$/.test(eventKey)) {
    const event = (await loadWorkbookAttendance()).find(
      (row) => row.date === eventKey,
    );
    if (!event) throw new OperationError("Historical event not found.", 404);
    rows = event.rows.map((row, i) => ({
      id: "historical:" + i,
      name: row.name,
      email: row.email,
      number: row.number,
      phone: row.mobile,
      organisation: row.organisation,
      plan: row.plan || "",
      registrationStatus: row.registrationStatus || "historical",
      attendance: row.status,
      source: "historical",
    }));
  } else {
    if (
      !/^[a-f0-9-]{36}$/i.test(eventKey) ||
      !(
        await db.query("SELECT 1 FROM tpa.events WHERE id::text=$1 AND deleted_at IS NULL", [eventKey])
      ).rowCount
    )
      throw new OperationError("Event not found.", 404);
    const result = await db.query(
      `SELECT r.id,r.status,r.version,r.registered_at,r.fee_paise,r.payment_status,r.registration_details,u.name,u.email,p.mobile_normalized,m.membership_number,m.type,
       CASE WHEN a.outcome='attended' THEN a.checked_in_at END AS checked_in_at,coalesce(a.outcome,'unmarked') AS outcome,coalesce(a.version,0) AS attendance_version,coalesce(a.note,'') AS attendance_note
       FROM tpa.event_registrations r JOIN public."user" u ON u.id=r.user_id
       LEFT JOIN tpa.people p ON p.user_id=u.id LEFT JOIN tpa.memberships m ON m.person_id=p.id
       LEFT JOIN tpa.event_attendance a ON a.registration_id=r.id
       WHERE r.event_id=$1 ORDER BY u.name,r.id`,
      [eventKey],
    );
    rows = result.rows.map((row) => ({
      id: row.id,
      name:
        [
          row.registration_details?.firstName,
          row.registration_details?.lastName,
        ]
          .filter(Boolean)
          .join(" ") || row.name,
      email: row.email,
      number: row.membership_number || "",
      phone: row.registration_details?.mobile || row.mobile_normalized || "",
      organisation: row.registration_details?.organization || "",
      plan: row.type || "",
      registrationStatus: row.status,
      attendance:
        row.outcome === "attended"
          ? "Attended"
          : row.outcome === "absent"
            ? "Not attended"
            : "Not recorded",
      source: "platform",
      live: row,
    }));
  }
  const { rows: members } = await db.query(
    `SELECT coalesce(u.email,p.contact_email,'') AS email,coalesce(m.membership_number,'') AS number,
     coalesce(p.mobile_normalized,'') AS phone,coalesce(p.accepted->>'name','') AS name,m.type
     FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id LEFT JOIN public."user" u ON u.id=p.user_id
     WHERE p.archived_at IS NULL`,
  );
  for (const row of rows) {
    if (row.plan) continue;
    const matches = members.filter((member) => rosterMatches(member, row));
    if (matches.length === 1) row.plan = matches[0].type || "";
  }
  const { rows: overrides } = await db.query(
    "SELECT identity,data FROM tpa.event_participant_overrides WHERE event_key=$1 ORDER BY identity",
    [eventKey],
  );
  for (const override of overrides) {
    const data = override.data as RosterRow;
    const matches = rows.filter(
      (row) => rosterMatches(row, data) || row.id === data.id,
    );
    if (matches.length === 1) {
      const index = rows.indexOf(matches[0]);
      rows[index] = {
        ...matches[0],
        ...data,
        id: matches[0].id,
        live: matches[0].live,
        source: matches[0].source,
      };
    } else if (!matches.length)
      rows.push({
        ...data,
        id: "imported:" + override.identity,
        source: "imported",
      });
  }
  return rows;
}
