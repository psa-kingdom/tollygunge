import { SiteShell } from "@/components/site-shell";
import { Invitation } from "@/components/onboarding-invitation";
export default function Page() {
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <h1>Set up your TPA account</h1>
        <Invitation />
      </main>
    </SiteShell>
  );
}
