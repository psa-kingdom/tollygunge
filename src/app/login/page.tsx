import { eventReturnPath } from "@/domain/event-flow";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { GoogleSignIn } from "@/components/auth-controls";
import { authConfigured } from "@/lib/auth";
import { OnboardingSignIn } from "@/components/onboarding-auth";
import { PasswordSignIn } from "@/components/password-controls";
import { currentActor } from "@/lib/actor";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Member sign-in",
  robots: { index: false, follow: false },
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const returnTo = eventReturnPath(query.returnTo);
  const switching = query.switch === "1";
  const requestedEmail =
    typeof query.email === "string" && query.email.length <= 254
      ? query.email
      : "";
  const actor = await currentActor();
  if (actor && !switching) redirect(returnTo ?? (actor.roles.length ? "/admin" : "/member"));
  const enabled =
    authConfigured() &&
    Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return (
    <SiteShell>
      <AuthLayout
        portalReview
        title={actor && switching ? "Switch accounts" : "Welcome back"}
        description="Sign in to manage your profile, documents, and TPA activities."
      >
          {actor && switching && (
            <p className="notice">
              You are currently signed in as <strong>{actor.email}</strong>.
              Enter the other account’s email and password to change the active
              account in this browser.{" "}
              <Link href={actor.roles.length ? "/admin" : "/member"}>
                Keep using your current account
              </Link>
              .
            </p>
          )}
          {process.env.ONBOARDING_ENABLED === "true" ? (
            <OnboardingSignIn initialEmail={requestedEmail} returnTo={returnTo} />
          ) : (
            <PasswordSignIn enabled={authConfigured()} returnTo={returnTo} />
          )}
          {enabled && <>
            <div className="auth-divider">or</div>
            <GoogleSignIn enabled={enabled} returnTo={returnTo} />
          </>}
          {!authConfigured() && process.env.ONBOARDING_ENABLED !== "true" && (
            <p className="notice">
              Sign-in is temporarily unavailable. Please try again later.
            </p>
          )}
          {process.env.ONBOARDING_ENABLED === "true" && (
            <p className="auth-switch">New to TPA?{" "}<Link href={returnTo ? "/signup?returnTo="+encodeURIComponent(returnTo) : "/signup"}>Create an account</Link></p>
          )}
          <p className="auth-policy auth-membership-note">A TPA account is separate from approved membership.</p>
      </AuthLayout>
    </SiteShell>
  );
}
