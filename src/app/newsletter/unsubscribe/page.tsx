import { SiteShell } from "@/components/site-shell";
import { NewsletterLinkAction } from "@/components/newsletter-link-action";
export const metadata = { title: "TPA subscription", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function Page() { return <SiteShell variant="v3"><NewsletterLinkAction action="unsubscribe" /></SiteShell>; }
