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
            <span className="eyebrow">MEMBER SPACE</span>
            <h1>Your professional profile</h1>
            <p>
              A clear identity. Meaningful connections. Your details, in your
              control.
            </p>
          </div>
          <div className="member-account-identity">
            <span>Account email · private</span>
            <strong>{actor.email}</strong>
          </div>
        </div>

        <MemberProfile
          storageEnabled={privateStorageConfigured()}
          email={actor.email}
        />
      </main>
    </AccountShell>
  );
}
