import { StatusBadge } from "@/components/portal-values";
import { PortalSubsections } from "@/components/portal-subsections";
import { PaymentsWorkspace } from "@/components/payments-workspace";
import { VerificationWorkspace } from "@/components/verification-workspace";
import {
  BulkOnboarding,
  OnboardingEmailSettings,
} from "@/components/bulk-onboarding";
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
import { GovernanceWorkspace } from "@/components/governance-workspace";
import { staffWorkspaceLabel } from "@/domain/staff-navigation";
import { MembersWorkspace } from "@/components/members-workspace";
import { WorkspacePageHeading } from "@/components/workspace-ui";
import {WebsiteControl} from '@/components/website-control';
import review from "@/components/portal-review.module.css";
const permissions: Record<string, Permission> = {
  verification: "members:review",
  onboarding: "staff:manage",
  "onboarding-email": "staff:manage",
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
  website:'content:publish',
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
    <main id="main" className={`workspace-main workspace-page ${workspace === "members" ? review.review : ""}`}>
      <div className="portal-page-intro"><WorkspacePageHeading workspace={workspace} title={staffWorkspaceLabel(workspace)} />
      <PortalSubsections /></div>
      {['communications','onboarding-email'].includes(workspace) && process.env.TPA_MAIL_SINK === 'true' && <p className="portal-delivery-state"><StatusBadge tone="testing">Mail sink</StatusBadge> Messages are captured locally; external delivery is disabled in this environment.</p>}
      <div className="workspace-body" data-workspace={workspace}>
      {workspace==='website'?<WebsiteControl/>:workspace === "verification" ? (
        <VerificationWorkspace />
      ) : workspace === "onboarding" ? (
        <BulkOnboarding />
      ) : workspace === "onboarding-email" ? (
        <OnboardingEmailSettings />
      ) : workspace === "governance" ? (
        <GovernanceWorkspace />
      ) : workspace === "media" ? (
        <MediaWorkspace />
      ) : workspace === "access" ? (
        <StaffAccess />
      ) : workspace === "imports" ? (
        <HistoryImport />
      ) : workspace === "communications" ? (
        <CommunicationsWorkspace canManageInvitations={hasPermission(actor.roles,'staff:manage')} />
      ) : workspace === "flyers" ? (
        <FlyerBuilder />
      ) : workspace === "content" ? (
        <ContentWorkspace />
      ) : workspace === "events" ? (
        <EventManager
          canPromote={hasPermission(actor.roles, "communications:manage")}
          canVerifyPayments={hasPermission(actor.roles, "payments:manage")}
        />
      ) : workspace === "crm" ? (
        <CrmWorkspace />
      ) : workspace === "reports" ? (
        <OperationsReports />
      ) : workspace === "members" ? (
        <MembersWorkspace
          canManage={hasPermission(actor.roles, "staff:manage")}
        />
      ) : workspace === "payments" ? (
        <PaymentsWorkspace />
      ) : (
        <>
          <p className="notice">
            Transactional email and campaign delivery have separate readiness
            checks. Shared inbox and official WhatsApp also await provider
            setup.
          </p>
          <Link href="/admin/workspaces/crm">
            Open inquiry assignment and follow-ups →
          </Link>
        </>
      )}
      </div>
    </main>
  );
}
