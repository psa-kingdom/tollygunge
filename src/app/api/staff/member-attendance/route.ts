import { authorized, operation, OperationError } from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { uuid } from "@/domain/operations";
import { ownWorkbookAttendance } from "@/domain/member-attendance";
import { loadWorkbookAttendance } from "@/lib/workbook-attendance";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "members:review");
    const personId = uuid(new URL(request.url).searchParams.get("personId"));
    const db = getDatabase();
    const people = await db.query<{ user_id: string | null; mobile_normalized: string | null }>("SELECT user_id,mobile_normalized FROM tpa.people WHERE id=$1 AND archived_at IS NULL", [personId]);
    if (!people.rows.length) throw new OperationError("Member not found.", 404);
    const memberships = await db.query<{ membership_number: string }>("SELECT membership_number FROM tpa.memberships WHERE person_id=$1", [personId]);
    const historicalAttendance = ownWorkbookAttendance(await loadWorkbookAttendance({ includeDeleted: true }), memberships.rows.map(row => row.membership_number), [people.rows[0].mobile_normalized || ""]);
    const userId = people.rows[0].user_id;
    const attendedEvents = userId ? (await db.query("SELECT DISTINCT e.id,e.title,e.starts_at FROM tpa.event_registrations r JOIN tpa.event_attendance a ON a.registration_id=r.id JOIN tpa.events e ON e.id=r.event_id WHERE r.user_id=$1 AND a.outcome='attended' ORDER BY e.starts_at DESC", [userId])).rows : [];
    return { historicalAttendance, attendedEvents };
  });
}
