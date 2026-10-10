import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { AccountShell as SiteShell } from "@/components/site-shell";
import { PasswordUpdate } from "@/components/password-controls";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Account security",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!(await currentActor())) redirect("/login");
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <section className="login-panel">
          <h1>Account security</h1>
          <PasswordUpdate signedIn />
          <p>
            <Link href="/member">Back to your account</Link>
          </p>
        </section>
      </main>
    </SiteShell>
  );
}
