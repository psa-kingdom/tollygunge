import { SiteShell } from "@/components/site-shell";
import { Signup } from "@/components/onboarding-auth";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (await currentActor()) redirect("/member");
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <h1>Create your TPA account</h1>
        {process.env.ONBOARDING_ENABLED === "true" ? (
          <Signup />
        ) : (
          <p>Account registration is not available yet.</p>
        )}
      </main>
    </SiteShell>
  );
}
