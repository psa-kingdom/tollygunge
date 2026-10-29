import { AuthLayout } from "@/components/auth-layout";
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
      <AuthLayout portalReview title="Reset your password" description="Request a private, single-use link that expires in 15 minutes.">
          <RecoveryRequest enabled={recoveryConfigured()} />
          <p>
            <Link href="/login">Back to sign-in</Link>
          </p>
      </AuthLayout>
    </SiteShell>
  );
}
