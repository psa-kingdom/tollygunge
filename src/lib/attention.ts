import "server-only";
import { getDatabase } from "./database";
import { hasPermission } from "@/domain/access";
type Actor = { id: string; roles: string[] };
export async function attentionFor(actor: Actor) {
  const db = getDatabase();
  const items: {
    id: string;
    label: string;
    href: string;
    category: string;
    priority: "High" | "Normal" | "Low";
    count: number;
  }[] = [];
  async function add(
    id: string,
    sql: string,
    label: string,
    href: string,
    category: string,
    priority: "High" | "Normal" | "Low" = "Normal",
    args: unknown[] = [],
  ) {
    const count = Number((await db.query(sql, args)).rows[0]?.n || 0);
    if (count)
      items.push({
        id,
        label: `${count} ${label}`,
        href,
        category,
        priority,
        count,
      });
  }
  if (hasPermission(actor.roles, "members:review"))
    await add(
      "verification",
      "SELECT count(*)::int n FROM tpa.verification_submissions WHERE status='pending'",
      "profiles awaiting verification",
      "/admin/workspaces/verification",
      "Verification",
    );
  if (hasPermission(actor.roles, "content:publish"))
    await add(
      "content",
      "SELECT count(*)::int n FROM tpa.content_entries WHERE published IS NULL OR draft<>published",
      "content drafts awaiting publication",
      "/admin/workspaces/content",
      "Publication",
      "Low",
    );
  if (actor.roles.includes("administrator"))
    await add(
      "profile-reviews",
      "SELECT count(*)::int n FROM tpa.profile_reviews WHERE status='pending'",
      "personal profile changes awaiting review",
      "/admin/workspaces/governance?review=pending",
      "Verification",
    );
  if (hasPermission(actor.roles, "content:publish"))
    await add(
      "profile-publication",
      "SELECT count(*)::int n FROM tpa.people WHERE accepted_verified AND (published IS NULL OR (jsonb_set(accepted,'{links}',coalesce((SELECT jsonb_agg(l) FROM jsonb_array_elements(coalesce(accepted->'links','[]')) l WHERE l->>'public'='true'),'[]'))-'phone')<>(published-'verified'-'phone')) AND jsonb_array_length(coalesce(accepted->'assignments','[]'))>0",
      "association profiles awaiting publication",
      "/admin/workspaces/governance",
      "Publication",
      "Low",
    );
  if (hasPermission(actor.roles, "communications:manage")) {
    await add(
      "overdue",
      "SELECT count(*)::int n FROM tpa.inquiries WHERE status<>'closed' AND follow_up_at<now()",
      "overdue inquiries",
      "/admin/workspaces/crm?focus=overdue",
      "Inquiries",
      "High",
    );
    await add(
      "unassigned",
      "SELECT count(*)::int n FROM tpa.inquiries WHERE status<>'closed' AND assigned_to IS NULL",
      "unassigned inquiries",
      "/admin/workspaces/crm?focus=unassigned",
      "Inquiries",
    );
    await add(
      "inbox",
      "SELECT count(*)::int n FROM tpa.email_conversations WHERE unread AND NOT archived",
      "unread conversations",
      "/admin/workspaces/communications",
      "Communications",
    );
    await add(
      "delivery",
      "SELECT count(*)::int n FROM tpa.email_jobs WHERE status IN ('failed','review')",
      "email jobs needing attention",
      "/admin/workspaces/communications",
      "Delivery",
      "High",
    );
    await add(
      "quota",
      "SELECT count(*)::int n FROM tpa.email_jobs WHERE status='queued' AND reason='quota_wait'",
      "email jobs waiting for quota",
      "/admin/workspaces/communications",
      "Delivery",
      "Low",
    );
    if (process.env.EMAIL_OPERATIONS_ENABLED === "true")
      await add(
        "worker",
        "SELECT CASE WHEN EXISTS(SELECT 1 FROM tpa.email_worker_state WHERE id='email' AND heartbeat_at>now()-interval '90 seconds') THEN 0 ELSE 1 END n",
        "email worker health alert",
        "/admin/workspaces/communications",
        "Delivery",
        "High",
      );
  }
  if (!actor.roles.length) {
    await add(
      "email",
      'SELECT count(*)::int n FROM public."user" WHERE id=$1 AND NOT "emailVerified"',
      "email verification required",
      "/member",
      "Account",
      "Normal",
      [actor.id],
    );
    await add(
      "updates",
      "SELECT count(*)::int n FROM tpa.people WHERE user_id=$1 AND verification_update_requested",
      "profile update requested",
      "/member/application",
      "Verification",
      "Normal",
      [actor.id],
    );
  }
  if (!actor.roles.length)
    await add(
      "corrections",
      "SELECT count(*)::int n FROM tpa.verification_submissions s WHERE s.user_id=$1 AND s.status IN ('corrections','rejected') AND NOT EXISTS(SELECT 1 FROM tpa.verification_submissions newer WHERE newer.user_id=s.user_id AND newer.created_at>s.created_at)",
      "profile review feedback to address",
      "/member/application",
      "Verification",
      "Normal",
      [actor.id],
    );
  return items.sort(
    (a, b) =>
      ["High", "Normal", "Low"].indexOf(a.priority) -
      ["High", "Normal", "Low"].indexOf(b.priority),
  );
}
