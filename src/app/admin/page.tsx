import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { attentionFor } from "@/lib/attention";
import { staffNavigation } from "@/domain/staff-navigation";
import { operationalOverview } from "@/lib/operational-overview";
import { PortalIcon } from "@/components/portal-icon";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff workspace",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!actor.roles.length) redirect("/member");
  const attention = await attentionFor(actor);
  const overview = await operationalOverview(actor.roles);
  const workspaceCount = staffNavigation(actor.roles)
    .flatMap((g) => g.items)
    .filter((x) => x.href !== "/admin").length;
  return (
    <main id="main" className="workspace-main portal-overview">
      <header className="portal-page-heading">
      <span className="eyebrow">TPA / STAFF</span>
      <h1>Welcome, {actor.name}.</h1>
      <p>
        What needs your attention today? Review a record, take action, and
        confirm the outcome.
      </p>
      </header>
      <div className="service-shortcuts service-metrics">
        {overview.metrics.map((m, index) => (
          <Link key={m.label} href={m.href}>
            <strong>{m.count}</strong>
            <span className="metric-label">{m.label}</span>
            <PortalIcon name={["people", "shield", "file", "profile", "mail", "wallet", "calendar", "calendar"][index] ?? "chart"} className="metric-icon" />
          </Link>
        ))}
      </div>
      <div className="dashboard-bento">
        <section className="bento-card bento-primary">
          <span className="eyebrow">YOUR NEXT ACTION</span>
          <h2>Needs attention</h2>
          {attention.length ? (
            attention.map((item) => (
              <a className="attention-row" key={item.id} href={item.href}>
                <span>{item.label}</span>
                <small>
                  {item.category} · {item.priority} →
                </small>
              </a>
            ))
          ) : (
            <p>You’re up to date in your permitted workspaces.</p>
          )}
        </section>
        <section className="bento-card bento-status">
          <span className="eyebrow">WORKSPACE STATUS</span>
          <h2>{attention.length}</h2>
          <p>Active alerts needing attention</p>
          <p>{workspaceCount} permitted workspaces</p>
          <div className="portal-account-shortcuts">
          <Link href="/account/profile" className="text-link">
            Your profile →
          </Link>
          <Link href="/member/security" className="text-link">
            Account security →
          </Link>
          </div>
        </section>
      </div>
      {overview.activity.length > 0 && (
        <section className="bento-card">
          <h2>Recent activity</h2>
          <ul className="portal-activity-list">
          {overview.activity.map((a, index) => (
            <li key={index}>
              <div><strong>{a.name || "System"}</strong><span> · {a.action.replaceAll(".", " ").replaceAll("_", " ")}</span></div>
              <time dateTime={new Date(a.created_at).toISOString()}>{new Date(a.created_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
              })}</time>
            </li>
          ))}
          </ul>
        </section>
      )}
      <p>
        <Link className="text-link" href="/preview/admin">
          Explore the labelled design preview →
        </Link>
      </p>
    </main>
  );
}
