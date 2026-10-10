import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { AccountShell as SiteShell } from "@/components/site-shell";
import { MemberEvents } from "@/components/member-events";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your events",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!(await currentActor())) redirect("/login");
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <Link href="/member">← Your member space</Link>
        <h1>Events & attendance</h1>
        <MemberEvents />
      </main>
    </SiteShell>
  );
}
