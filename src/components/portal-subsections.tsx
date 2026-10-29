import { currentActor } from "@/lib/actor";
import { portalNavigation } from "@/domain/portal-navigation";
import { PortalNavigation } from "./portal-navigation";
export async function PortalSubsections() {
  const actor = await currentActor();
  return (
    <PortalNavigation
      groups={portalNavigation(actor?.roles ?? [])}
      subsections
    />
  );
}
