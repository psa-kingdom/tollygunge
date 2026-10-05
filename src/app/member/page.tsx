import { redirect } from "next/navigation";
import Link from "next/link";
import { AccountShell as SiteShell } from "@/components/site-shell";
import { currentActor } from "@/lib/actor";
import { MemberProfile } from "./profile";
import { privateStorageConfigured } from "@/lib/private-storage";
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
      <main id="main" className="page-content">
        <span className="eyebrow">YOUR MEMBER SPACE</span>
        <h1>Hello, {actor.name}.</h1>
        <p>{actor.email}</p>
        <div className="notice">
          Your account is ready. Save a membership draft, register for published
          events and track your inquiries below. Membership approval and payment
          services will open after association rules and checkout are
          configured.
        </div>
        <MemberProfile storageEnabled={privateStorageConfigured()} />
        <nav aria-label="Your account services" className="action-row">
          <Link className="button secondary" href="/member/application">
            Membership application
          </Link>
          <Link className="button secondary" href="/member/events">
            Events & attendance
          </Link>
          <Link className="button secondary" href="/member/inquiries">
            Your inquiries
          </Link>
          <Link className="button secondary" href="/member/payments">
            Association payment details
          </Link>
        </nav>
        <p>
          <Link className="text-link" href="/member/security">
            Account security →
          </Link>
        </p>
      </main>
    </SiteShell>
  );
}
