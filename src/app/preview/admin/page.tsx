import Link from "@/components/navigation-link";
import { ReviewWorkspace } from "./review-workspace";
import { AdminDashboardView } from "@/components/admin-dashboard-view";

export const metadata = {
  title: "Admin Command Center | TPA Preview",
  robots: { index: false, follow: false },
};

const previewMetrics = [
  { label: "Active members", count: 202, href: "/preview/admin/workspaces/members" },
  { label: "Profiles needing review", count: 3, href: "#review-applications" },
  { label: "Upcoming events", count: 4, href: "/preview/admin/workspaces/events" },
  { label: "Upcoming registrations", count: 86, href: "/preview/admin/workspaces/events" },
  { label: "Payments needing verification", count: 2, href: "/preview/admin/workspaces/payments" },
  { label: "Invitations held", count: 12, href: "/preview/admin/workspaces/communications" },
];

const previewAttention = [
  { id: "verification", label: "3 membership applications awaiting verification", href: "#review-applications", category: "Verification", priority: "High" },
  { id: "payments", label: "1 UPI payment instruction awaiting payee verification", href: "/preview/admin/workspaces/payments", category: "Finance", priority: "High" },
  { id: "inquiries", label: "2 public inquiries awaiting staff assignment", href: "/preview/admin/workspaces/crm", category: "Inquiries", priority: "Normal" },
];

const previewActivity = [
  { name: "Priya Sen", action: "application.submitted", time: "Today, 2:15 PM" },
  { name: "Admin Operator", action: "payment_details.activated", time: "Today, 11:30 AM" },
  { name: "Amitav Ghosh", action: "event.registered", time: "Yesterday, 5:45 PM" },
  { name: "Content Editor", action: "news.published", time: "Yesterday, 3:10 PM" },
];

export default function AdminPreview() {
  const subsections = (
    <div className="portal-subsections" aria-label="Subsections">
      <Link href="/preview/admin" aria-current="page">
        Dashboard
      </Link>
      <Link href="/preview/admin/workspaces/members">
        Members Directory
      </Link>
      <Link href="#review-applications">
        Applications Queue
      </Link>
      <Link href="#attention">
        Attention Items
      </Link>
      <Link href="#activity">
        Recent Activity
      </Link>
      <Link href="/">
        Public Website ↗
      </Link>
    </div>
  );

  const extraSections = (
    <section className="bento-card" id="review-applications" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 6px" }}>Membership Application Review Queue</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            Interactive preview with synthetic applicant dossiers. Review, approve, or reject applicants with live validation.
          </p>
        </div>
        <span className="inquiry-status status-new">Live Test Sandbox</span>
      </div>
      <div className="notice" style={{ marginBottom: 16 }}>
        Interactive design preview. All records are fictional. Review actions change this browser view only; they do not approve live memberships or issue refunds.
      </div>
      <ReviewWorkspace />
    </section>
  );

  return (
    <AdminDashboardView
      liveAttention={false}
      adminName="Administrator"
      subsections={subsections}
      metrics={previewMetrics}
      attentionItems={previewAttention}
      workspaceCount={previewAttention.length}
      activity={previewActivity}
      extraSections={extraSections}
    />
  );
}
