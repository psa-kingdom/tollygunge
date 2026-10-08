import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { hasPermission, type Permission } from "@/domain/access";
import { ContentWorkspace } from "@/components/content-workspace";
import { EventManager } from "@/components/event-manager";
import { CrmWorkspace } from "@/components/crm-workspace";
import { OperationsReports } from "@/components/operations-reports";
import { CommunicationsWorkspace } from "@/components/communications-workspace";
import { FlyerBuilder } from "@/components/flyer-builder";
import { HistoryImport } from "@/components/history-import";
import { StaffAccess } from "@/components/staff-access";
import { MediaWorkspace } from "@/components/media-workspace";
import { PaymentDetailsManager } from "@/components/payment-details";
import { GovernanceWorkspace } from "@/components/governance-workspace";
import { staffWorkspaceLabel } from "@/domain/staff-navigation";
import { MembersWorkspace } from "@/components/members-workspace";
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
  governance: "content:publish",
};
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return {
    title: staffWorkspaceLabel(workspace),
    robots: { index: false, follow: false },
  };
}
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
      : workspace === "governance"
        ? !hasPermission(actor.roles, "content:publish") &&
          !hasPermission(actor.roles, "members:review")
        : !permissions[workspace] ||
          !hasPermission(actor.roles, permissions[workspace])
  )
    notFound();
  return (
    <main id="main" className="workspace-main">
      <Link href="/admin">← Staff workspace</Link>
      <h1>{staffWorkspaceLabel(workspace)}</h1>
      {workspace === "governance" ? (
        <GovernanceWorkspace />
      ) : workspace === "media" ? (
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
        <ContentWorkspace />
      ) : workspace === "events" ? (
        <EventManager />
      ) : workspace === "crm" ? (
        <CrmWorkspace />
      ) : workspace === "reports" ? (
        <OperationsReports />
      ) : workspace === "members" ? (
        <MembersWorkspace />
      ) : workspace === "payments" ? (
        <PaymentDetailsManager />
      ) : (
        <>
          <p className="notice">
            Transactional email and campaign delivery have separate readiness checks.
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
