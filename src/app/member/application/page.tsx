import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { AccountShell as SiteShell } from "@/components/site-shell";
import { ApplicationDraft } from "@/components/application-draft";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your verification details",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <Link href="/member">← Your member space</Link>
        <h1>Your verification details</h1>
        <ApplicationDraft name={actor.name} userId={actor.id} />
      </main>
    </SiteShell>
  );
}
