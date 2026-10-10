import { SiteShell } from "@/components/site-shell";
import { RecoveryRequest } from "@/components/password-controls";
import { recoveryConfigured } from "@/lib/auth-email";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Password recovery",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <section className="login-panel">
          <h1>Reset your password</h1>
          <p>Request a private, single-use link that expires in 15 minutes.</p>
          <RecoveryRequest enabled={recoveryConfigured()} />
          <p>
            <Link href="/login">Back to sign-in</Link>
          </p>
        </section>
      </main>
    </SiteShell>
  );
}
