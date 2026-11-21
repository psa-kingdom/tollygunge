import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { attentionFor } from "@/lib/attention";
import { staffNavigation } from "@/domain/staff-navigation";
import { operationalOverview } from "@/lib/operational-overview";
import { portalActivityLabel } from "@/domain/portal-presentation";
import { PortalSubsections } from "@/components/portal-subsections";
import { AdminDashboardView } from "@/components/admin-dashboard-view";

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

  const activity = overview.activity.map((a) => ({
    name: a.name || "System",
    action: portalActivityLabel(a.action),
    time: new Date(a.created_at).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }),
  }));

  return (
    <AdminDashboardView
      adminName={actor.name}
      subsections={<PortalSubsections />}
      metrics={overview.metrics}
      attentionItems={attention}
      workspaceCount={workspaceCount}
      activity={activity}
    />
  );
}
