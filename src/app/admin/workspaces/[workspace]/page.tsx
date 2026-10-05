import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { hasPermission, type Permission } from "@/domain/access";
import { ContentEditor } from "@/components/content-editor";
import { EventManager } from "@/components/event-manager";
import { CrmWorkspace } from "@/components/crm-workspace";
import { OperationsReports } from "@/components/operations-reports";
import { CommunicationsWorkspace } from "@/components/communications-workspace";
import { FlyerBuilder } from "@/components/flyer-builder";
import { HistoryImport } from "@/components/history-import";
import { StaffAccess } from "@/components/staff-access";
import { MediaWorkspace } from "@/components/media-workspace";
const permissions: Record<string, Permission> = {
  members: "members:review",
  events: "events:manage",
  content: "content:publish",
  communications: "communications:manage",
  payments: "payments:manage",
  crm: "communications:manage",
  flyers: "events:manage",
  imports: "events:manage",
  access: "staff:manage",
  media: "content:publish",
};
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Workspace({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const { workspace } = await params;
  if (
    workspace === "reports"
      ? !actor.roles.length
      : !permissions[workspace] ||
        !hasPermission(actor.roles, permissions[workspace])
  )
    notFound();
  return (
    <main id="main" className="page-content">
      <Link href="/admin">← Staff workspace</Link>
      <h1>{workspace[0].toUpperCase() + workspace.slice(1)}</h1>
      {workspace === "media" ? (
        <MediaWorkspace />
      ) : workspace === "access" ? (
        <StaffAccess />
      ) : workspace === "imports" ? (
        <HistoryImport />
      ) : workspace === "communications" ? (
        <CommunicationsWorkspace />
      ) : workspace === "flyers" ? (
        <FlyerBuilder />
      ) : workspace === "content" ? (
        <ContentEditor />
      ) : workspace === "events" ? (
        <EventManager />
      ) : workspace === "crm" ? (
        <CrmWorkspace />
      ) : workspace === "reports" ? (
        <OperationsReports />
      ) : workspace === "members" ? (
        <div className="notice">
          Application drafts are private to applicants. The paid-application
          review queue will open after membership fees, eligibility,
          declarations, refund terms and a payment gateway are confirmed.
        </div>
      ) : workspace === "payments" ? (
        <div className="notice">
          Payment collection, receipts and refunds await the payment gateway and
          approved financial rules. No payment has been collected.
        </div>
      ) : (
        <>
          <p className="notice">
            Resend is selected for email delivery and will be configured later.
            Shared inbox and official WhatsApp also await provider setup.
          </p>
          <Link href="/admin/workspaces/crm">
            Open inquiry assignment and follow-ups →
          </Link>
        </>
      )}
    </main>
  );
}
