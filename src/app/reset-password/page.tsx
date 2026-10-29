import { AuthLayout } from "@/components/auth-layout";
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
      <AuthLayout portalReview title="Choose a new password" description="Use your recovery link to secure your account.">
          <PasswordResetLanding />
      </AuthLayout>
    </SiteShell>
  );
}
