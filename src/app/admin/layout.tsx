import Link from "next/link";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { staffNavigation } from "@/domain/staff-navigation";
import { Brand } from "@/components/site-shell";
import { StaffNavigation } from "@/components/staff-navigation";
import { SignOut } from "@/components/auth-controls";
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
        <div className="staff-sidebar-footer">
          <span className="staff-avatar" aria-hidden="true">
            {actor.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{actor.name}</strong>
            <small>Staff account</small>
          </div>
          <Link href="/account/profile">Your profile</Link>
          <Link href="/member/security">Account security</Link>
          <Link href="/">Public website ↗</Link>
          <SignOut />
        </div>
      </aside>
      <div className="staff-content">{children}</div>
    </div>
  );
}
