import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { hasPermission, type Permission } from "@/domain/access";
import { Brand } from "@/components/site-shell";
import { SignOut } from "@/components/auth-controls";
import { getDatabase } from "@/lib/database";
const workspaces: [string, Permission][] = [
  ["Members", "members:review"],
  ["Events", "events:manage"],
  ["Flyers", "events:manage"],
  ["Imports", "events:manage"],
  ["Content", "content:publish"],
  ["Media", "content:publish"],
  ["Communications", "communications:manage"],
  ["CRM", "communications:manage"],
  ["Payments", "payments:manage"],
  ["Access", "staff:manage"],
];
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
  }
  if (hasPermission(actor.roles, "communications:manage")) {
    const counts = (
      await getDatabase().query(
        "SELECT count(*) FILTER(WHERE status<>'resolved' AND assigned_to IS NULL)::int AS unassigned,count(*) FILTER(WHERE status<>'resolved' AND follow_up_at<now())::int AS overdue FROM tpa.inquiries",
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
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <span className="eyebrow">STAFF WORKSPACE</span>
        <nav aria-label="Workspace">
          <Link href="/admin" className="current">
            Overview
          </Link>
          {workspaces
            .filter(([, permission]) => hasPermission(actor.roles, permission))
            .map(([name]) => (
              <Link key={name} href={`/admin/workspaces/${name.toLowerCase()}`}>
                {name}
              </Link>
            ))}
        </nav>
        <Link href="/admin/workspaces/reports">Reports</Link>
        <Link href="/member">Your profile</Link>
        <SignOut />
      </aside>
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
        <div className="action-row">
          {workspaces
            .filter(([, permission]) => hasPermission(actor.roles, permission))
            .map(([name]) => (
              <Link
                className="button secondary"
                key={name}
                href={`/admin/workspaces/${name.toLowerCase()}`}
              >
                {name}
              </Link>
            ))}
        </div>
      </main>
    </div>
  );
}
