import { PortalSubsections } from "@/components/portal-subsections";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { AccountShell as SiteShell } from "@/components/site-shell";
import { Inquiries } from "@/components/inquiries";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your inquiries",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!(await currentActor())) redirect("/login");
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <h1>Contact the secretariat</h1>
        <PortalSubsections />
        <Inquiries />
      </main>
    </SiteShell>
  );
}
