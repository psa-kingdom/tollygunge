import { getDatabase } from "@/lib/database";
import { hasPermission } from "@/domain/access";
import { operation, authorized, OperationError } from "@/lib/operation-api";
import { reportRange } from "@/domain/report-range";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request);
    if (!actor.roles.length)
      throw new OperationError("Staff access required.", 403);
    let range;
    try {
      range = reportRange(new URL(request.url).searchParams);
    } catch (error) {
      throw new OperationError((error as Error).message, 400);
    }
    const dates = [range.from, range.to];
    const reports: Record<string, unknown> = {};
    if (hasPermission(actor.roles, "events:manage"))
      reports.events = (
        await getDatabase().query(
          "SELECT e.title,e.starts_at,e.status,count(r.id) FILTER(WHERE r.status='registered')::int AS registrations,count(a.registration_id)::int AS attendance FROM tpa.events e LEFT JOIN tpa.event_registrations r ON r.event_id=e.id LEFT JOIN tpa.event_attendance a ON a.registration_id=r.id WHERE ($1::date IS NULL OR e.starts_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Kolkata')) AND ($2::date IS NULL OR e.starts_at < (($2::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata')) GROUP BY e.id ORDER BY e.starts_at DESC LIMIT 200",
          dates,
        )
      ).rows;
    if (hasPermission(actor.roles, "content:publish"))
      reports.content = (
        await getDatabase().query(
          "SELECT kind,count(*)::int AS total,count(published)::int AS published FROM tpa.content_entries GROUP BY kind",
        )
      ).rows;
    if (hasPermission(actor.roles, "communications:manage")) {
      reports.inquiries = (
        await getDatabase().query(
          "SELECT status,count(*)::int AS total,count(*) FILTER(WHERE status<>'closed' AND follow_up_at<now())::int AS overdue FROM tpa.inquiries WHERE ($1::date IS NULL OR created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Kolkata')) AND ($2::date IS NULL OR created_at < (($2::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata')) GROUP BY status",
          dates,
        )
      ).rows;
      reports.newsletter = (
        await getDatabase().query(
          "SELECT count(*)::int AS opted_in FROM tpa.newsletter_consents WHERE subscribed=true",
        )
      ).rows[0];
    }
    return reports;
  });
}
