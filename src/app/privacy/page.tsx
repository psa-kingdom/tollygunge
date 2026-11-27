import { SiteShell } from "@/components/site-shell";
import { PublicContentView } from "@/components/public-content-view";
import { publishedPage } from "@/lib/public-content";
import { sitePages } from "@/domain/site-pages";
import { publicMetadata } from "@/domain/public-metadata";
export const dynamic = "force-dynamic";
export const metadata = publicMetadata(
  "/privacy",
  "Privacy",
  "How TPA uses account, membership, inquiry and event information, and how to contact the association about your data.",
);
export default async function Privacy() {
  const data = (await publishedPage("privacy")) ?? {
    ...sitePages.privacy,
    sourceUrl: "",
    attribution: "",
  };
  return (
    <SiteShell>
      <PublicContentView page="privacy" data={data} />
    </SiteShell>
  );
}
