import { PortalSubsections } from "@/components/portal-subsections";
import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { attentionFor } from "@/lib/attention";
import { staffNavigation } from "@/domain/staff-navigation";
import { operationalOverview } from "@/lib/operational-overview";
import { DashboardAttention } from "@/components/dashboard-attention";
import { PortalIcon } from "@/components/portal-icon";
import { dashboardMetricPresentation } from "@/domain/dashboard-presentation";
import { portalActivityLabel } from "@/domain/portal-presentation";
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
      <div className="portal-page-intro"><header className="portal-page-heading">
      <h1>Welcome, {actor.name}.</h1>
      <p>
        What needs your attention today? Review a record, take action, and
        confirm the outcome.
      </p>
      </header>
      <PortalSubsections /></div>
      <div className="service-shortcuts service-metrics">
        {overview.metrics.map((m) => (
          <Link key={m.label} href={m.href} data-count={m.count} data-tone={dashboardMetricPresentation(m.label, m.count).tone}>
            <strong>{m.count}</strong>
            <span className="metric-label">{m.label}</span>
            <PortalIcon name={dashboardMetricPresentation(m.label, m.count).icon} className="metric-icon" />
          </Link>
        ))}
      </div>
      <DashboardAttention initialItems={attention} workspaceCount={workspaceCount} />
      {overview.activity.length > 0 && (
        <section className="bento-card">
          <h2>Recent activity</h2>
          <ul className="portal-activity-list">
          {overview.activity.map((a, index) => (
            <li key={index}>
              <div><strong>{a.name || "System"}</strong><span> · {portalActivityLabel(a.action)}</span></div>
              <time dateTime={new Date(a.created_at).toISOString()}>{new Date(a.created_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
              })}</time>
            </li>
          ))}
          </ul>
        </section>
      )}

    </main>
  );
}
