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

export function ResourceMediaGallery({ media, preview = false }: { media: ResourceImage[]; preview?: boolean }) {
  return (
    <div className="resource-card-grid">
      {media.map(({ id, width, height, published }) => (
        <figure className="resource-gallery-tile" key={id}
          data-cms-record={preview ? `media:${id}` : undefined}>
          <a href={`/media/${id}`} aria-label={`View ${published.title}`}>
            <Image unoptimized src={`/media/${id}`} width={width} height={height}
              alt={published.altText} />
          </a>
          <figcaption>{published.title}{published.category && <small>{published.category}</small>}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function ResourceArchive({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main id="main" className="public-information public-resource-archive">
      <div className="page-heading">
        <div className="page-heading-copy">
          <Link className="text-link" href="/resources">Back to Resources</Link>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="content-page">{children}</div>
    </main>
  );
}
