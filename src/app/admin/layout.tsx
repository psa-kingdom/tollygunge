import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { PortalShell } from "@/components/site-shell";
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
    <PortalShell actor={actor}>{children}</PortalShell>
  );
}
