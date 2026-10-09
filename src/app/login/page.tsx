import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { GoogleSignIn } from "@/components/auth-controls";
import { authConfigured } from "@/lib/auth";
import { OnboardingSignIn } from "@/components/onboarding-auth";
import { PasswordSignIn } from "@/components/password-controls";
import { currentActor } from "@/lib/actor";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Member sign-in",
  robots: { index: false, follow: false },
};
export default async function Login() {
  const actor = await currentActor();
  if (actor) redirect(actor.roles.length ? "/admin" : "/member");
  const enabled =
    authConfigured() &&
    Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <span className="eyebrow">YOUR TPA ACCOUNT</span>
        <h1>Welcome back.</h1>
        <p>
          Keep your profile and private documents together in your member space.
        </p>
        <section className="login-panel">
          <h2>Sign in securely</h2>
          <p>
            Sign in with your assigned account. A TPA account does not
            automatically confer approved membership.
          </p>
          {process.env.ONBOARDING_ENABLED === "true" ? <OnboardingSignIn/> : <PasswordSignIn enabled={authConfigured()} />}
          {process.env.ONBOARDING_ENABLED === "true" && <Link href="/signup">Create an account</Link>}
          <GoogleSignIn enabled={enabled} />
          {!enabled && (
            <p className="notice">
              Google sign-in is not available yet. Use your assigned account to sign in.
            </p>
          )}
        </section>
      </main>
    </SiteShell>
  );
}
