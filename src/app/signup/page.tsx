import { eventReturnPath } from "@/domain/event-flow";
import { SiteShell } from "@/components/site-shell";
import { Signup } from "@/components/onboarding-auth";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Create your account",
  robots: { index: false, follow: false },
};
export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const returnTo = eventReturnPath(query.returnTo);
  if (await currentActor()) redirect(returnTo ?? "/member");
  return (
    <SiteShell>
      <AuthLayout portalReview title="Create your TPA account" description="Start with an account. Complete your profile and apply for membership when you’re ready.">
        {process.env.ONBOARDING_ENABLED === "true" ? (
          <Signup returnTo={returnTo} />
        ) : (
          <div className="notice"><p>Account registration is not available yet. If you already have an account, you can sign in.</p><Link href="/login">Sign in to your account</Link></div>
        )}
      </AuthLayout>
    </SiteShell>
  );
}
