import { PortalSubsections } from "@/components/portal-subsections";
import { AccountShell } from "@/components/site-shell";
import { currentActor } from "@/lib/actor";
import { getDatabase } from "@/lib/database";
import { membershipPlans } from "@/lib/membership-plans";
import { redirect } from "next/navigation";
import { MembershipPlan } from "./membership-plan";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Membership plan",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const actor = await currentActor();
  if (!actor) redirect("/login");

  const [{ rows: [membership] }, plans] = await Promise.all([
    getDatabase().query<{ type: string }>(
      `SELECT m.type
       FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id
       WHERE p.user_id=$1 AND p.archived_at IS NULL`,
      [actor.id],
    ),
    membershipPlans(true),
  ]);

  return (
    <AccountShell>
      <main id="main" className="member-content">
        <PortalSubsections />
        <MembershipPlan plans={plans} current={membership?.type ?? null} />
      </main>
    </AccountShell>
  );
}
