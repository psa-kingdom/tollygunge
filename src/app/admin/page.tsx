import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { attentionFor } from "@/lib/attention";
import { staffNavigation } from "@/domain/staff-navigation";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff workspace",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!actor.roles.length) redirect("/member");
  const attention = await attentionFor(actor);
  const shortcuts = staffNavigation(actor.roles)
    .flatMap((g) => g.items)
    .filter((x) => x.href !== "/admin");
  return (
    <main id="main" className="workspace-main">
      <span className="eyebrow">TPA / STAFF</span>
      <h1>Welcome, {actor.name}.</h1>
      <p>Your access reflects your assigned association responsibilities.</p>
      <div className="dashboard-bento">
        <section className="bento-card bento-primary">
          <span className="eyebrow">YOUR NEXT ACTION</span>
          <h2>Needs attention</h2>
          {attention.length ? (
            attention.map((item) => (
              <a className="attention-row" key={item.id} href={item.href}>
                <span>{item.label}</span>
                <small>
                  {item.category} · {item.priority} →
                </small>
              </a>
            ))
          ) : (
            <p>You’re up to date in your permitted workspaces.</p>
          )}
        </section>
        <section className="bento-card">
          <span className="eyebrow">WORKSPACE STATUS</span>
          <h2>{attention.length}</h2>
          <p>Active alerts needing attention</p>
          <p>{shortcuts.length} permitted workspaces</p>
        </section>
        <section className="bento-card">
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h2>Profile & security</h2>
          <p>Manage your personal details and sign-in settings.</p>
          <Link href="/account/profile" className="text-link">
            Your profile →
          </Link>
          <br />
          <Link href="/member/security" className="text-link">
            Account security →
          </Link>
        </section>
        <section className="bento-card bento-shortcuts">
          <h2>Your workspaces</h2>
          <div className="service-shortcuts">
            {shortcuts.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label} <span>→</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <p>
        <Link className="text-link" href="/preview/admin">
          Explore the labelled design preview →
        </Link>
      </p>
    </main>
  );
}
