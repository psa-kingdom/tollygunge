import Link from "@/components/navigation-link";
import { notFound } from "next/navigation";
import { WorkspacePageHeading } from "@/components/workspace-ui";
import { ReviewWorkspace } from "../../review-workspace";

const workspaces: Record<string, { title: string; description: string }> = {
  members: {
    title: "Membership Directory & Review",
    description: "Manage membership records, inspect applicant qualifications, and review applications.",
  },
  events: {
    title: "Events Hub",
    description: "Event publishing, registration capacity quotas, and attendee attendance tracking.",
  },
  content: {
    title: "Content & CMS",
    description: "Website drafts, editorial rich-text content, media assets, and published snapshots.",
  },
  crm: {
    title: "Inquiries & CRM",
    description: "Public intake inquiries triage, staff follow-up assignments, and internal communications.",
  },
  communications: {
    title: "Communications & Broadcasts",
    description: "Shared inbox, audience segmentation, email templates, and campaign broadcasting.",
  },
  payments: {
    title: "Payment Instructions",
    description: "Association bank details, UPI ID configurations, and verified payee QR snapshots.",
  },
  governance: {
    title: "Governance & Committees",
    description: "Manage leadership profiles, committee rosters, and verified portraits.",
  },
  access: {
    title: "Staff Access & Security",
    description: "Operational role assignments, session revocation, and immutable audit logs.",
  },
  reports: {
    title: "Scoped Reports & Exports",
    description: "Role-scoped analytics, attendance logs, and verified CSV/XLSX data exports.",
  },
  media: {
    title: "Editorial Media Library",
    description: "Normalized WebP imagery, EXIF metadata removal, and accessible asset publication.",
  },
  flyers: {
    title: "Flyer Builder",
    description: "Dynamic one- and two-speaker event flyers with auto-generated verification QR passes.",
  },
};

export const metadata = { robots: { index: false, follow: false } };

const previewPayments = [
  { member: "Sample Member A", purpose: "Life membership", amount: 2500, method: "UPI", status: "Verified" },
  { member: "Sample Member B", purpose: "Student membership", amount: 1000, method: "Bank transfer", status: "Pending review" },
  { member: "Sample Member C", purpose: "Tax workshop", amount: 750, method: "UPI", status: "Verified" },
  { member: "Sample Member D", purpose: "Patron membership", amount: 10000, method: "Bank transfer", status: "Verified" },
  { member: "Sample Member E", purpose: "Life membership", amount: 2500, method: "Cheque", status: "Pending review" },
  { member: "Sample Member F", purpose: "Professional seminar", amount: 500, method: "UPI", status: "Needs clarification" },
  { member: "Sample Member G", purpose: "Life membership", amount: 2500, method: "Bank transfer", status: "Verified" },
  { member: "Sample Member H", purpose: "Student membership", amount: 1000, method: "UPI", status: "Verified" },
  { member: "Sample Member I", purpose: "Networking dinner", amount: 1500, method: "UPI", status: "Pending review" },
  { member: "Sample Member J", purpose: "Life membership", amount: 2500, method: "Cheque", status: "Needs clarification" },
  { member: "Sample Member K", purpose: "Tax workshop", amount: 750, method: "Bank transfer", status: "Verified" },
  { member: "Sample Member L", purpose: "Patron membership", amount: 10000, method: "UPI", status: "Pending review" },
];

export default async function Workspace({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const config = workspaces[workspace];
  if (!config) notFound();

  return (
    <main id="main" className="workspace-main workspace-page">
      <div className="portal-page-intro">
        <WorkspacePageHeading
          workspace={workspace}
          title={config.title}
          description={config.description}
        />
      </div>

      {workspace === "members" ? (
        <section className="bento-card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>Applicant Verification Queue</h2>
          </div>
          <ReviewWorkspace />
        </section>
      ) : (
        <div className="bento-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span className="eyebrow" style={{ textTransform: "uppercase" }}>WORKSPACE PREVIEW · {workspace}</span>
          </div>
          <h2>{config.title}</h2>
          <div className="notice" style={{ marginBottom: 24 }}>
            This workspace view is running in design preview mode with synthetic records. You can explore all navigation tabs and switch workspaces seamlessly.
          </div>
          {workspace === "payments" && (
            <section aria-label="Sample payment records">
              <h3>Payment records · {previewPayments.length} samples</h3>
              <p>Illustrative payments only. References and verification statuses are fictional.</p>
              <div className="table-wrap" role="region" aria-label="Preview payments" tabIndex={0} style={{ marginBottom: 24 }}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Member / reference</th>
                      <th scope="col">Purpose</th>
                      <th scope="col">Date</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Method</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewPayments.map((payment, index) => (
                      <tr key={payment.member}>
                        <td><strong>{payment.member}</strong><small>DEMO-PAY-{String(index + 1).padStart(3, "0")}</small></td>
                        <td>{payment.purpose}</td>
                        <td>{String(24 - index).padStart(2, "0")} Oct 2026</td>
                        <td>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(payment.amount)}</td>
                        <td>{payment.method}</td>
                        <td><span className={`badge${payment.status === "Verified" ? "" : " pending"}`}>{payment.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="button" href="/preview/admin">
               Return to Dashboard
            </Link>
            <Link className="button secondary" href="/preview/admin/workspaces/members">
              Review Members
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
