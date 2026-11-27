import { SiteShell } from "@/components/site-shell";
import { ResourceArchive, ResourceArticleCards } from "@/components/resource-collections";
import { publicMetadata } from "@/domain/public-metadata";
import { publishedArticles } from "@/lib/public-content";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("/blogs", "Blogs", "Published blogs from Tollygunge Professional Association.");

export default async function BlogsPage() {
  const articles = await publishedArticles();
  return (
    <SiteShell>
      <ResourceArchive title="Blogs">
        {articles.length ? <ResourceArticleCards articles={articles} /> : <p>No articles have been published yet.</p>}
      </ResourceArchive>
    </SiteShell>
  );
}
