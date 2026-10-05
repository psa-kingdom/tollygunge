import { redirect } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { SiteShell } from "@/components/site-shell";
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
        <Link href="/member">← Your member space</Link>
        <h1>Contact the secretariat</h1>
        <Inquiries />
      </main>
    </SiteShell>
  );
}
