import { PortalSubsections } from "@/components/portal-subsections";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { AccountShell } from "@/components/site-shell";
import { MemberPaymentDetails } from "@/components/payment-details";
import { MemberMembershipPayments } from '@/components/membership-payments';
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Payment details",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!(await currentActor())) redirect("/login");
  return (
    <AccountShell>
      <main id="main" className="page-content">
        <div className="portal-page-intro">
          <header>
            <h1 className="sr-only">Association payment details</h1>
          </header>
          <PortalSubsections />
        </div>
        <MemberMembershipPayments />
        <MemberPaymentDetails />
      </main>
    </AccountShell>
  );
}
