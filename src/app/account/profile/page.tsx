import { redirect } from "next/navigation";
import { currentActor } from "@/lib/actor";
import { AccountShell } from "@/components/site-shell";
import { MemberProfile } from "@/app/member/profile";
import { privateStorageConfigured } from "@/lib/private-storage";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your profile",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return (
    <AccountShell>
      <main id="main" className="page-content">
        <h1>Your profile</h1>
        <p>{actor.email}</p>
        <MemberProfile storageEnabled={privateStorageConfigured()} />
      </main>
    </AccountShell>
  );
}
