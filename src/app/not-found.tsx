import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
export default function NotFound() {
  return (
    <SiteShell>
      <main id="main" className="page-heading">
        <span className="eyebrow">404</span>
        <h1>This page isn’t here.</h1>
        <p>Return to the association homepage to find what you need.</p>
        <Link className="button" href="/">
          Back to TPA →
        </Link>
      </main>
    </SiteShell>
  );
}
