import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { hasPermission } from "@/domain/access";
import { getDatabase } from "@/lib/database";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff workspace",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!actor.roles.length) redirect("/member");
  const attention: { label: string; href: string }[] = [];
  if (hasPermission(actor.roles, "content:publish")) {
    const count = (
      await getDatabase().query(
        "SELECT count(*)::int AS n FROM tpa.content_entries WHERE published IS NULL OR draft<>published",
      )
    ).rows[0].n;
    if (count)
      attention.push({
        label: `${count} saved content drafts awaiting publication`,
        href: "/admin/workspaces/content",
      });
    const profileDrafts = (
      await getDatabase().query(
        "SELECT count(*)::int AS n FROM tpa.people WHERE accepted_verified AND (published IS NULL OR (jsonb_set(accepted,'{links}',coalesce((SELECT jsonb_agg(l) FROM jsonb_array_elements(coalesce(accepted->'links','[]')) l WHERE l->>'public'='true'),'[]'))-'phone')<>(published-'verified'-'phone')) AND jsonb_array_length(coalesce(accepted->'assignments','[]'))>0",
      )
    ).rows[0].n;
    if (profileDrafts)
      attention.push({
        label: `${profileDrafts} saved association profiles awaiting publication`,
        href: "/admin/workspaces/governance",
      });
  }
  if (actor.roles.includes("administrator")) {
    const count = (
      await getDatabase().query(
        "SELECT count(*)::int AS n FROM tpa.profile_reviews WHERE status='pending'",
      )
    ).rows[0].n;
    if (count)
      attention.push({
        label: `${count} personal profile changes awaiting administrator review`,
        href: "/admin/workspaces/governance?review=pending",
      });
  }
  if (hasPermission(actor.roles, "communications:manage")) {
    const counts = (
      await getDatabase().query(
        "SELECT count(*) FILTER(WHERE status<>'closed' AND assigned_to IS NULL)::int AS unassigned,count(*) FILTER(WHERE status<>'closed' AND follow_up_at<now())::int AS overdue FROM tpa.inquiries",
      )
    ).rows[0];
    if (counts.unassigned)
      attention.push({
        label: `${counts.unassigned} unassigned inquiries`,
        href: "/admin/workspaces/crm",
      });
    if (counts.overdue)
      attention.push({
        label: `${counts.overdue} overdue follow-ups`,
        href: "/admin/workspaces/crm",
      });
  }
  return (
    <main id="main" className="workspace-main">
      <span className="eyebrow">TPA / STAFF</span>
      <h1>Welcome, {actor.name}.</h1>
      <p>Your access reflects your assigned association responsibilities.</p>
      <section className="content-section">
        <h2>Needs attention</h2>
        {attention.length ? (
          attention.map((item) => (
            <p key={item.label}>
              <Link className="text-link" href={item.href}>
                {item.label} →
              </Link>
            </p>
          ))
        ) : (
          <p>
            No publication drafts or inquiry follow-ups need attention in your
            permitted workspaces.
          </p>
        )}
      </section>
      <div className="notice">
        Content publishing, free events and attendance, and inquiry follow-ups
        are available. Membership drafts can be saved; submission and payments
        await approved rules.
      </div>
      <p>
        <Link className="text-link" href="/preview/admin">
          Explore the labelled design preview →
        </Link>
      </p>
    </main>
  );
}
