import { SiteShell } from "@/components/site-shell";
import { PasswordResetLanding } from "@/components/password-controls";
export const metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function Page() {
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <section className="login-panel">
          <h1>Choose a new password</h1>
          <PasswordResetLanding />
        </section>
      </main>
    </SiteShell>
  );
}
