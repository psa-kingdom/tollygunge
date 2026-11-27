import { PortalSubsections } from "@/components/portal-subsections";
import { eventReturnPath } from "@/domain/event-flow";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { AccountShell as SiteShell } from "@/components/site-shell";
import { MemberEvents } from "@/components/member-events";
import { VerifyEmail } from "@/components/onboarding-auth";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your events",
  robots: { index: false, follow: false },
};
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const target = eventReturnPath(`/member/events?eventId=${query.eventId}`) ?? "/member/events";
  const actor = await currentActor();
  if (!actor) redirect("/login?returnTo="+encodeURIComponent(target));
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <h1 className="sr-only">Events & attendance</h1>
        <PortalSubsections />
        {actor.plan === "Free" && !actor.emailVerified ? (
          <>
            <p>Verify your email to register for events.</p>
            <VerifyEmail email={actor.email} verified={false} returnTo={target} />
          </>
        ) : <MemberEvents />}
      </main>
    </SiteShell>
  );
}
