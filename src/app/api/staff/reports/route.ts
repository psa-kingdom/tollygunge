import { getDatabase } from "@/lib/database";
import { hasPermission } from "@/domain/access";
import { operation, authorized, OperationError } from "@/lib/operation-api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request);
    if (!actor.roles.length)
      throw new OperationError("Staff access required.", 403);
    const reports: Record<string, unknown> = {};
    if (hasPermission(actor.roles, "events:manage"))
      reports.events = (
        await getDatabase().query(
          "SELECT e.title,e.starts_at,e.status,count(r.id) FILTER(WHERE r.status='registered')::int AS registrations,count(a.registration_id)::int AS attendance FROM tpa.events e LEFT JOIN tpa.event_registrations r ON r.event_id=e.id LEFT JOIN tpa.event_attendance a ON a.registration_id=r.id GROUP BY e.id ORDER BY e.starts_at DESC LIMIT 200",
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
          "SELECT status,count(*)::int AS total,count(*) FILTER(WHERE status<>'closed' AND follow_up_at<now())::int AS overdue FROM tpa.inquiries GROUP BY status",
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
