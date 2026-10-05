import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { hasPermission, type Permission } from "@/domain/access";
const permissions: Record<string, Permission> = {
  members: "members:review",
  events: "events:manage",
  content: "content:publish",
  communications: "communications:manage",
  payments: "payments:manage",
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
    !permissions[workspace] ||
    !hasPermission(actor.roles, permissions[workspace])
  )
    notFound();
  return (
    <main id="main" className="page-content">
      <Link href="/admin">← Staff workspace</Link>
      <h1>{workspace[0].toUpperCase() + workspace.slice(1)}</h1>
      <p>This workspace will open with its corresponding operational slice.</p>
    </main>
  );
}
