import { PortalSubsections } from "@/components/portal-subsections";
import { eventReturnPath } from "@/domain/event-flow";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { AccountShell as SiteShell } from "@/components/site-shell";
import { MemberEvents } from "@/components/member-events";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your events",
  robots: { index: false, follow: false },
};
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const target = eventReturnPath(`/member/events?eventId=${query.eventId}`) ?? "/member/events";
  if (!(await currentActor())) redirect("/login?returnTo="+encodeURIComponent(target));
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <h1>Events & attendance</h1>
        <PortalSubsections />
        <MemberEvents />
      </main>
    </SiteShell>
  );
}
