import { eventReturnPath } from "@/domain/event-flow";
import { SiteShell } from "@/components/site-shell";
import { Signup } from "@/components/onboarding-auth";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const returnTo = eventReturnPath(query.returnTo);
  if (await currentActor()) redirect(returnTo ?? "/member");
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <h1>Create your TPA account</h1>
        {process.env.ONBOARDING_ENABLED === "true" ? (
          <Signup returnTo={returnTo} />
        ) : (
          <p>Account registration is not available yet.</p>
        )}
      </main>
    </SiteShell>
  );
}
