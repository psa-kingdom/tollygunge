import { PortalSubsections } from "@/components/portal-subsections";
import { CopyValue } from "@/components/portal-values";
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
      <main id="main" className="member-content member-profile-page">
        <div className="member-page-heading">
          <div>
            <h1>Your professional profile</h1>
            <p>
              Update your professional details and public profile preferences.
            </p>
          </div>
          <div className="member-account-identity">
            <span>Account email · private</span>
            <CopyValue value={actor.email} />
          </div>
        </div>
        <PortalSubsections />

        <MemberProfile
          storageEnabled={privateStorageConfigured()}
          email={actor.email}
        />
      </main>
    </AccountShell>
  );
}
