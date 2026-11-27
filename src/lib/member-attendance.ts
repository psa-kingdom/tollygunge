import "server-only";
import type { Pool, PoolClient } from "pg";
import { loadWorkbookAttendance } from "./workbook-attendance";
import { ownWorkbookAttendance, attendanceMobileKey } from "@/domain/member-attendance";

export async function memberWorkbookAttendance(db: Pool | PoolClient, userId: string) {
  // Fail closed for a number shared by multiple people, even if only one is linked.
  const { rows } = await db.query<{ membership_number: string }>(`
    SELECT m.membership_number FROM tpa.memberships m
    JOIN tpa.people p ON p.id=m.person_id WHERE p.user_id=$1
    AND nullif(btrim(m.membership_number),'') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM tpa.memberships other
      WHERE other.person_id<>m.person_id
      AND ltrim(lower(btrim(other.membership_number)),'0')=ltrim(lower(btrim(m.membership_number)),'0')
    )`, [userId]);
  const people = (await db.query<{ id: string; mobile_normalized: string | null }>("SELECT id,mobile_normalized FROM tpa.people WHERE user_id=$1 AND archived_at IS NULL", [userId])).rows;
  const mobiles: string[] = [];
  for (const person of people) {
    const phone = attendanceMobileKey(person.mobile_normalized || "");
    if (!phone) continue;
    const conflicts = await db.query("SELECT 1 FROM tpa.people WHERE id<>$1 AND right(regexp_replace(coalesce(mobile_normalized,''),'[^0-9]','','g'),10)=$2", [person.id, phone]);
    if (!conflicts.rowCount) mobiles.push(phone);
  }
  // Do not fall back to a membership number when a recorded phone is shared.
  if (people.some(person => attendanceMobileKey(person.mobile_normalized || "")) && !mobiles.length) return [];
  if (!rows.length && !mobiles.length) return [];
  return ownWorkbookAttendance(await loadWorkbookAttendance({ includeDeleted: true }), rows.map(row => row.membership_number), mobiles);
}
