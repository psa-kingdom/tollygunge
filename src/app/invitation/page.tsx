import { AuthLayout } from "@/components/auth-layout";
import { SiteShell } from "@/components/site-shell";
import { Invitation } from "@/components/onboarding-invitation";
export default function Page() {
  return (
    <SiteShell>
      <AuthLayout portalReview title="Set up your TPA account" description="Accept your invitation and complete your account details.">
        <Invitation />
      </AuthLayout>
    </SiteShell>
  );
}
