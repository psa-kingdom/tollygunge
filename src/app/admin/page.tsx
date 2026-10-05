import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { hasPermission, type Permission } from "@/domain/access";
import { Brand } from "@/components/site-shell";
import { SignOut } from "@/components/auth-controls";
const workspaces: [string, Permission][] = [
  ["Members", "members:review"],
  ["Events", "events:manage"],
  ["Content", "content:publish"],
  ["Communications", "communications:manage"],
  ["Payments", "payments:manage"],
];
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff workspace",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!actor.roles.length) redirect("/member");
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <span className="eyebrow">STAFF WORKSPACE</span>
        <nav aria-label="Workspace">
          <Link href="/admin" className="current">
            Overview
          </Link>
          {workspaces
            .filter(([, permission]) => hasPermission(actor.roles, permission))
            .map(([name]) => (
              <Link key={name} href={`/admin/workspaces/${name.toLowerCase()}`}>
                {name}
              </Link>
            ))}
        </nav>
        <Link href="/member">Your profile</Link>
        <SignOut />
      </aside>
      <main id="main" className="workspace-main">
        <span className="eyebrow">TPA / STAFF</span>
        <h1>Welcome, {actor.name}.</h1>
        <p>Your access reflects your assigned association responsibilities.</p>
        <div className="notice">
          Business workspaces are being delivered in stages. No membership
          applications or payments are active yet.
        </div>
        <p>
          <Link className="text-link" href="/preview/admin">
            Explore the labelled design preview →
          </Link>
        </p>
      </main>
    </div>
  );
}
