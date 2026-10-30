import { PortalSubsections } from "@/components/portal-subsections";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { AccountShell as SiteShell } from "@/components/site-shell";
import { ApplicationDraft } from "@/components/application-draft";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your verification details",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const query = await searchParams;
  const requestedStep = Number(query.step);
  const initialStep =
    Number.isInteger(requestedStep) && requestedStep >= 0 && requestedStep <= 4
      ? requestedStep
      : undefined;
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return (
    <SiteShell>
      <main id="main" className="member-content member-application">
        <div className="portal-page-intro">
          <header>
            <h1>Your verification details</h1>
          </header>
          <PortalSubsections />
        </div>
        <ApplicationDraft
          name={actor.name}
          userId={actor.id}
          initialStep={initialStep}
        />
      </main>
    </SiteShell>
  );
}
