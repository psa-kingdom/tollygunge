import Link from "next/link";
import { cookies } from "next/headers";
import { SiteShell } from "@/components/site-shell";
import { SignOut } from "@/components/auth-controls";
import { currentActor } from "@/lib/actor";
import {
  readVerificationResult,
  verificationResultCookie,
} from "@/lib/email-verification-result";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Email verification",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default async function EmailVerification() {
  const result = readVerificationResult(
    (await cookies()).get(verificationResultCookie)?.value,
    process.env.BETTER_AUTH_SECRET ?? "",
  );
  const actor = await currentActor();
  const sameAccount =
    result?.email?.toLowerCase() === actor?.email.toLowerCase();
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <span className="eyebrow">YOUR TPA ACCOUNT</span>
        <h1>
          {result?.status === "verified"
            ? "Email verified."
            : result?.status === "expired"
              ? "Verification link expired."
              : "Check your verification link."}
        </h1>
        <section className="login-panel">
          {result?.status === "verified" ? (
            <>
              <p>
                Your email address <strong>{result.email}</strong> is verified.
                Profile verification is a separate administrator review.
              </p>
              {actor && !sameAccount ? (
                <>
                  <p>
                    You are currently signed in as{" "}
                    <strong>{actor.email}</strong>. To use the verified account,
                    sign in with that email below or open a private window.
                  </p>
                  <Link
                    className="button"
                    href={
                      "/login?switch=1&email=" +
                      encodeURIComponent(result.email ?? "")
                    }
                  >
                    Sign in to the verified account
                  </Link>
                  <SignOut />
                  <Link
                    className="button secondary"
                    href={actor.roles.length ? "/admin" : "/member"}
                  >
                    Continue current account
                  </Link>
                </>
              ) : (
                <Link className="button" href={actor ? "/member" : "/login"}>
                  {actor
                    ? "Continue to your portal"
                    : "Sign in to your verified account"}
                </Link>
              )}
            </>
          ) : (
            <>
              <p>
                {result?.status === "expired"
                  ? "This link has passed its 24-hour expiry. Sign in and request a new verification email from your dashboard."
                  : "Open the verification link from your email. If it is invalid or this confirmation has expired, sign in and request a fresh link from your dashboard."}
              </p>
              <Link
                className="button"
                href={
                  actor ? (actor.roles.length ? "/admin" : "/member") : "/login"
                }
              >
                {actor ? "Continue current account" : "Sign in"}
              </Link>
            </>
          )}
        </section>
      </main>
    </SiteShell>
  );
}
