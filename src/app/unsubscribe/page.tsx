import { EmailUnsubscribe } from "@/components/email-unsubscribe";
import { SiteShell } from "@/components/site-shell";
export const metadata = {
  title: "Newsletter preferences | TPA",
  robots: { index: false, follow: false },
};
export default function Unsubscribe() {
  return (
    <SiteShell>
      <main id="main" className="section">
        <div className="content-section">
          <h1>Newsletter preferences</h1>
          <EmailUnsubscribe />
        </div>
      </main>
    </SiteShell>
  );
}
