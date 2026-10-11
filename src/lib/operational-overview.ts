import "server-only";
import { getDatabase } from "./database";
import { hasPermission } from "@/domain/access";
export async function operationalOverview(roles: string[]) {
  const db = getDatabase(),
    metrics: { label: string; count: number; href: string }[] = [];
  const pending: Promise<unknown>[] = [];
  function metric(label: string, sql: string, href: string) {
    const item = { label, href, count: 0 };
    metrics.push(item);
    pending.push(
      db.query(sql).then((result) => {
        item.count = Number(result.rows[0].n);
      }),
    );
  }
  if (hasPermission(roles, "members:review")) {
    await metric(
      "Total members",
      "SELECT count(*)::int n FROM tpa.memberships",
      "/admin/workspaces/members",
    );
    await metric(
      "Active members",
      "SELECT count(*)::int n FROM tpa.memberships WHERE status='active' AND (valid_from IS NULL OR valid_from<=current_date) AND (valid_until IS NULL OR valid_until>=current_date)",
      "/admin/workspaces/members",
    );
    await metric(
      "Membership issues",
      "SELECT count(*)::int n FROM tpa.memberships WHERE status IS NULL OR status<>'active' OR valid_until<current_date",
      "/admin/workspaces/members",
    );
    await metric(
      "Profiles needing review",
      "SELECT count(*)::int n FROM tpa.verification_submissions WHERE status='pending'",
      "/admin/workspaces/verification",
    );
  }
  if (hasPermission(roles, "staff:manage"))
    await metric(
      "Pending invitations",
      "SELECT count(DISTINCT user_id)::int n FROM tpa.onboarding_invitations WHERE redeemed_at IS NULL",
      "/admin/workspaces/members",
    );
  if (hasPermission(roles, "payments:manage"))
    await metric(
      "Payments needing verification",
      "SELECT count(*)::int n FROM tpa.event_registrations WHERE payment_status='pending' AND status='registered'",
      "/admin/workspaces/payments",
    );
  if (hasPermission(roles, "events:manage")) {
    await metric(
      "Upcoming events",
      "SELECT count(*)::int n FROM tpa.events WHERE status='published' AND starts_at>now()",
      "/admin/workspaces/events",
    );
    await metric(
      "Upcoming registrations",
      "SELECT count(*)::int n FROM tpa.event_registrations r JOIN tpa.events e ON e.id=r.event_id WHERE r.status='registered' AND e.status='published' AND e.starts_at>now()",
      "/admin/workspaces/events",
    );
  }
  await Promise.all(pending);
  const activity = roles.includes("administrator")
    ? (
        await db.query(
          'SELECT a.action,a.created_at,u.name FROM tpa.audit_events a LEFT JOIN public."user" u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 12',
        )
      ).rows
    : [];
  return { metrics, activity };
}
