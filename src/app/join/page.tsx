import { SiteShell } from "@/components/site-shell";
import { ApplicationForm } from "./application-form";
import Link from "next/link";
export const metadata = { title: "Membership application preview" };
export default function Join() {
  return (
    <SiteShell>
      <main id="main">
        <div className="page-heading">
          <span className="eyebrow">BECOME PART OF TPA</span>
          <h1>Your perspective belongs here.</h1>
          <p>
            One application. A shared commitment to connect, learn and
            contribute.
          </p>
          <div className="notice">
            Application preview · No personal details are sent or saved.
            Membership fees and eligibility will be published before
            applications open.
          </div>
          <p>
            <Link className="button" href="/member/application">
              Sign in to save your application →
            </Link>
          </p>
        </div>
        <ApplicationForm />
      </main>
    </SiteShell>
  );
}
