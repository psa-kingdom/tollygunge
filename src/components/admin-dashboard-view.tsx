import Link from "@/components/navigation-link";
import { DashboardAttention } from "./dashboard-attention";
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
  liveAttention?: boolean;
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
  liveAttention = true,
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

      <DashboardAttention live={liveAttention} initialItems={attentionItems.map(item => ({ ...item, count: item.count ?? 0 }))} workspaceCount={workspaceCount} />

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

