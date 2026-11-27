import Image from "next/image";
import Link from "next/link";
import type { ContentBody } from "@/domain/operations";

export type ResourceArticle = { slug: string; published: ContentBody };
export type ResourceImage = {
  id: string;
  width: number;
  height: number;
  published: { title: string; altText: string; category: string };
};

export function ResourceArticleCards({ articles }: { articles: ResourceArticle[] }) {
  return (
    <div className="resource-card-grid">
      {articles.map(({ slug, published }) => (
        <article className="resource-article-card" key={slug}>
          {published.heroMediaId && (
            <Image className="resource-article-cover" unoptimized src={`/media/${published.heroMediaId}`}
              width={640} height={360} alt={published.heroAlt || ""} />
          )}
          <h3><Link href={`/resources/${slug}`}>{published.title}</Link></h3>
          {published.intro && <p>{published.intro}</p>}
        </article>
      ))}
    </div>
  );
}

export { ResourceMediaGallery } from "./resource-media-gallery";

export function ResourceArchive({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main id="main" className="public-information public-resource-archive">
      <div className="page-heading">
        <div className="page-heading-copy">
          <Link className="text-link" href="/resources">Back to Resources</Link>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="public-content-layout">
        <div className="content-page">{children}</div>
      </div>
    </main>
  );
}
