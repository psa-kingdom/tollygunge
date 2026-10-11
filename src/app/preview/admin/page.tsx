import Link from "next/link";
import { Brand } from "@/components/site-shell";
import { ReviewWorkspace } from "./review-workspace";
export const metadata = {
  title: "Admin workspace preview",
  robots: { index: false, follow: false },
};
export default function Admin() {
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <span className="eyebrow">ASSOCIATION WORKSPACE</span>
        <nav aria-label="Workspace">
          <Link className="current" href="/preview/admin">
            Members
          </Link>
          {["Events", "Content", "CRM", "Communications", "Payments"].map(
            (n) => (
              <Link
                key={n}
                href={`/preview/admin/workspaces/${n.toLowerCase()}`}
              >
                {n}
              </Link>
            ),
          )}
        </nav>
        <p style={{ fontSize: 11, marginTop: 30 }}>
          Design preview
          <br />
          Synthetic records only
        </p>
        <Link className="text-link" href="/">
          ← Public website
        </Link>
      </aside>
      <main id="main" className="workspace-main">
        <div className="workspace-top">
          <span>TPA / Members</span>
          <span>Preview workspace · No live account</span>
        </div>
        <h1>Membership, thoughtfully managed.</h1>
        <p>
          Review applications, keep records clear and help people find their
          place.
        </p>
        <div className="notice">
          Interactive design preview. All records are fictional. Review actions
          change this browser view only; they do not approve memberships or
          issue refunds.
        </div>
        <ReviewWorkspace />
      </main>
    </div>
  );
}
