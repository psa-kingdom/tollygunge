import Link from "@/components/navigation-link";
import { PortalIcon } from "@/components/portal-icon";
import { dashboardMetricPresentation } from "@/domain/dashboard-presentation";
import type { ReactNode } from "react";

export type MetricItem = {
  label: string;
  count: number;
  href: string;
};

export type AttentionItem = {
  id: string;
  label: string;
  href: string;
  category: string;
  priority: string;
  count?: number;
};

export type ActivityItem = {
  name: string;
  action: string;
  time: string;
};

export type AdminDashboardViewProps = {
  adminName: string;
  badge?: ReactNode;
  subsections?: ReactNode;
  metrics: MetricItem[];
  attentionItems: AttentionItem[];
  workspaceCount: number;
  activity: ActivityItem[];
  extraSections?: ReactNode;
};

export function AdminDashboardView({
  adminName,
  badge,
  subsections,
  metrics,
  attentionItems,
  workspaceCount,
  activity,
  extraSections,
}: AdminDashboardViewProps) {
  return (
    <main id="main" className="workspace-main portal-overview">
      <h1 className="sr-only">Staff workspace</h1>
      {subsections && (
        <div className="portal-page-intro" style={{ marginBottom: 16 }}>
          {subsections}
        </div>
      )}

      <div className="service-shortcuts service-metrics">
        {metrics.map((m) => {
          const presentation = dashboardMetricPresentation(m.label, m.count);
          return (
            <Link
              key={m.label}
              href={m.href}
              data-count={m.count}
              data-tone={presentation.tone}
            >
              <strong>{m.count}</strong>
              <span className="metric-label">{m.label}</span>
              <PortalIcon
                name={presentation.icon}
                className="metric-icon"
              />
            </Link>
          );
        })}
      </div>

      <div className="dashboard-bento" id="attention">
        <section
          className="bento-card bento-primary"
          aria-labelledby="dashboard-attention-title"
        >
          <span className="eyebrow">YOUR NEXT ACTION</span>
          <h2 id="dashboard-attention-title">Needs attention</h2>
          <p className="dashboard-alert-help">
            New sign-ups appear here while they complete their details.
            Submitted applications go to Verification for administrator review.
          </p>
          {attentionItems.length ? (
            attentionItems.map((item) => (
              <Link
                className="attention-row"
                data-tone={
                  item.count && item.count > 0 &&
                  (["verification", "profile-reviews", "membership-records"].includes(item.id) ||
                    item.priority.toLowerCase() === "high")
                    ? "warning"
                    : "blue"
                }
                key={item.id}
                href={item.href}
              >
                <span>{item.label}</span>
                <small>
                  {item.category} · {item.priority}{" "}
                  <span className="attention-arrow" aria-hidden="true">
                    →
                  </span>
                </small>
              </Link>
            ))
          ) : (
            <p>You’re up to date in your permitted workspaces.</p>
          )}
        </section>

        <section className="bento-card bento-status">
          <span className="eyebrow">WORKSPACE STATUS</span>
          <h2>{attentionItems.length}</h2>
          <p>Active alerts needing attention</p>
          <p>{workspaceCount} permitted workspaces</p>
        </section>
      </div>

      {activity.length > 0 && (
        <section className="bento-card" id="activity" style={{ marginTop: 16 }}>
          <h2>Recent activity</h2>
          <ul className="portal-activity-list">
            {activity.map((a, index) => (
              <li key={index}>
                <div>
                  <strong>{a.name || "System"}</strong>
                  <span> · {a.action}</span>
                </div>
                <time>{a.time}</time>
              </li>
            ))}
          </ul>
        </section>
      )}

      {extraSections}
    </main>
  );
}

