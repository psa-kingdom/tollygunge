import { MemberOnboarding } from "@/components/member-onboarding";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AccountShell as SiteShell } from "@/components/site-shell";
import { currentActor } from "@/lib/actor";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your member space",
  robots: { index: false, follow: false },
};
export default async function Member() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (actor.roles.length) redirect("/admin");
  return (
    <SiteShell>
      <main id="main" className="page-content member-home">
        <header className="member-welcome">
          <div>
            <span className="eyebrow">YOUR MEMBER SPACE</span>
            <h1>Hello, {actor.name}.</h1>
            <p>{actor.email}</p>
          </div>
          <span className="member-welcome-mark" aria-hidden="true">
            tpa<span>·</span>
          </span>
        </header>
        {process.env.ONBOARDING_ENABLED === "true" ? (
          <MemberOnboarding />
        ) : (
          <Link className="button" href="/member/application">
            Continue your application
          </Link>
        )}
        <section className="member-card member-profile-summary">
          <div>
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
                "01",
                "Events & attendance",
                "Discover learning opportunities and manage your registrations.",
              ],
              [
                "/member/inquiries",
                "02",
                "Your inquiries",
                "Follow your conversations with the association.",
              ],
              [
                "/member/security",
                "03",
                "Account security",
                "Manage your password and signed-in sessions.",
              ],
              [
                "/member/payments",
                "04",
                "Payment details",
                "View association payment information when available.",
              ],
            ].map(([href, number, title, description]) => (
              <Link className="member-service-tile" href={href} key={href}>
                <span className="eyebrow">{number}</span>
                <h3>
                  {title}
                  <span aria-hidden="true">↗</span>
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
