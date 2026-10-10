import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { staffNavigation } from "@/domain/staff-navigation";
import { Brand } from "@/components/site-shell";
import { StaffNavigation } from "@/components/staff-navigation";
import { AccountControls } from "@/components/account-controls";
import { WorkspaceSearch } from "@/components/workspace-search";
export const dynamic = "force-dynamic";
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!actor.roles.length) redirect("/member");
  return (
    <div className="workspace staff-shell">
      <aside className="sidebar staff-sidebar">
        <Brand />
        <p className="staff-label">Association workspace</p>
        <StaffNavigation groups={staffNavigation(actor.roles)} />
      </aside>
      <div className="staff-content">
        <header className="workspace-topbar">
          <WorkspaceSearch />
          <AccountControls actor={actor} />
        </header>
        {children}
      </div>
    </div>
  );
}
