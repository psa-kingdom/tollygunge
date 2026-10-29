import { attentionFor } from "@/lib/attention";
import { MemberOnboarding } from "@/components/member-onboarding";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AccountShell as SiteShell } from "@/components/site-shell";
import { currentActor } from "@/lib/actor";
import { MemberOverviewActivity } from "@/components/member-overview-activity";
import { MemberReviewHeading } from "@/components/portal-review";
import review from "@/components/portal-review.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your member space",
  robots: { index: false, follow: false },
};
export default async function Member() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (actor.roles.length) redirect("/admin");
  const attention = await attentionFor(actor);
  return (
    <SiteShell>
      <main id="main" className={`page-content member-home ${review.review} ${review.memberHome}`}>
        <MemberReviewHeading name={actor.name} email={actor.email} />
        {process.env.ONBOARDING_ENABLED === "true" ? (
          <MemberOnboarding attentionCount={attention.length} />
        ) : (
          <Link className="button" href="/member/application">
            Continue your application
          </Link>
        )}
        <MemberOverviewActivity />
        <p className="member-footnote">
          Profile verification, membership approval and payments are separate.
        </p>
      </main>
    </SiteShell>
  );
}
