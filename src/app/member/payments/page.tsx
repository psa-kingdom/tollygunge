import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { AccountShell } from "@/components/site-shell";
import { MemberPaymentDetails } from "@/components/payment-details";
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
        <h1>Association payment details</h1>
        <MemberPaymentDetails />
      </main>
    </AccountShell>
  );
}
