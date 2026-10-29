import { attentionFor } from "@/lib/attention";
import { MemberOnboarding } from "@/components/member-onboarding";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AccountShell as SiteShell } from "@/components/site-shell";
import { currentActor } from "@/lib/actor";
import { PortalIcon } from "@/components/portal-icon";
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
        <section className="member-card member-profile-summary">
          <div>
            <span className={review.profileIcon} aria-hidden="true"><PortalIcon name="profile" /></span>
            <span className="eyebrow">PERSONAL PROFILE</span>
            <h2>Your presence at TPA</h2>
            <p>
              Manage your biography, interests and public profile preferences.
              Your phone and evidence remain private.
            </p>
          </div>
          <Link className="button secondary" href="/account/profile">
            Manage profile →
          </Link>
        </section>
        <section
          className="member-services"
          aria-labelledby="member-services-title"
        >
          <h2 id="member-services-title">Explore your member space</h2>
          <div className="member-service-grid">
            {[
              [
                "/member/events",
                "calendar",
                "Events & attendance",
                "Discover learning opportunities and manage your registrations.",
              ],
              [
                "/member/inquiries",
                "message",
                "Your inquiries",
                "Follow your conversations with the association.",
              ],
              [
                "/member/security",
                "shield",
                "Account security",
                "Manage your password and signed-in sessions.",
              ],
              [
                "/member/payments",
                "wallet",
                "Payment details",
                "View association payment information when available.",
              ],
            ].map(([href, icon, title, description]) => (
              <Link className="member-service-tile" href={href} key={href} data-tone={icon === "message" || icon === "wallet" ? "teal" : "blue"}>
                <PortalIcon name={icon} />
                <h3>
                  {title}
                  <PortalIcon name="arrow" />
                </h3>
                <p>{description}</p>
              </Link>
            ))}
          </div>
        </section>
        <p className="member-footnote">
          Profile verification, membership approval and payments are separate.
        </p>
      </main>
    </SiteShell>
  );
}
