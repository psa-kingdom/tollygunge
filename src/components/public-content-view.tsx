import Link from "next/link";
import Image from "next/image";
import { PageReveals } from "./page-reveals";
import { PublicInquiry } from "./public-inquiry";
import { PublicBreadcrumbs } from "./public-breadcrumbs";
import {
  PublicGovernance,
  type PublicGovernanceEntry,
} from "./public-governance";
import { RichContent } from "./rich-content";
import type { ContentBody } from "@/domain/operations";
export type PublicContentContext = {
  defaultPage?:ContentBody;
  biographyTemplate?:string;
  importantLinks?: {id:string;published:{title:string;url:string;description:string}}[];
  downloads?: {id:string;published:{title:string;url:string;description:string;fileId:string|null}}[];
  people: PublicGovernanceEntry[];
  media: {
    id: string;
    width: number;
    height: number;
    published: { title: string; altText: string; category: string };
  }[];
  events: {
    id: string;
    title: string;
    ends_at: string;
    starts_at: string;
    location: string;
  }[];
  articles: { slug: string; published: ContentBody }[];
};
export const emptyContentContext: PublicContentContext = {
  people: [],
  media: [],
  events: [],
  articles: [],
};
export function PublicContentView({
  page,
  data,
  context = emptyContentContext,
  readOnly = false,
}: {
  page: string;
  data: ContentBody & { label?: string };
  context?: PublicContentContext;
  readOnly?: boolean;
}) {
  const { people, media, events, articles } = context;
  const illustration = page === "membership" || page === "about"
    ? "/design/book-community-watercolor.webp"
    : page === "resources" ? "/design/book-knowledge-watercolor.webp" : undefined;
  return (
    <main id="main" className="public-information">
      <PageReveals sectionsSelector=":scope > .content-page > .content-section" />
      <div className="page-heading">
        <div className="page-heading-copy">
        <span className="eyebrow">{data.label}</span>
        <h1
          className={
            data.titleSize ? `content-title-${data.titleSize}` : undefined
          }
        >
          {data.title}
        </h1>
        <RichContent document={data.introRich} text={data.intro} />
        </div>
        {illustration && <Image className="page-heading-art" src={illustration} width={480} height={480} sizes="(max-width: 767px) 260px, 390px" alt="" aria-hidden="true" />}
      </div>
      <div className="content-page">
        {data.sections.map((section, i) => (
          <section
            id={`section-${i}`}
            className="content-section"
            key={i}
          >
            <h2
              className={
                section.titleSize
                  ? `content-title-${section.titleSize}`
                  : undefined
              }
            >
              {section.title}
            </h2>
            <div className="public-section-body">
            <RichContent document={section.rich} text={section.text} />
            {["about", "governance"].includes(page) && (
              <PublicGovernance
                biographyTemplate={context.biographyTemplate}
                entries={people.filter(
                  (person) =>
                    person.published.page === page &&
                    person.published.section === i,
                )}
              />
            )}
            {page === "resources" && i === 1 && (
              <div className="media-gallery">
                {media.map((asset) => (
                  <figure key={asset.id}>
                    <Image
                      unoptimized
                      src={`/media/${asset.id}`}
                      width={asset.width}
                      height={asset.height}
                      alt={asset.published.altText}
                    />
                    <figcaption>
                      <strong>{asset.published.title}</strong>
                      <span>{asset.published.category}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            {page==='resources'&&i===2&&<div className="resource-row">{context.downloads?.map(resource=><article key={resource.id}><h3><a href={resource.published.fileId?`/downloads/${resource.id}`:resource.published.url}>{resource.published.title} ↓</a></h3><p>{resource.published.description}</p></article>)}</div>}
            {page === "events" &&
              i < 2 &&
              events
                .filter((event) =>
                  i === 0
                    ? new Date(event.ends_at) > new Date()
                    : new Date(event.ends_at) <= new Date(),
                )
                .map((event) => (
                  <article className="event-row" key={event.id}>
                    <div>
                      <h3>
                        <Link href={`/events/${event.id}`}>{event.title}</Link>
                      </h3>
                      <p>
                        {new Date(event.starts_at).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}{" "}
                        IST · {event.location}
                      </p>
                    </div>
                    <Link className="text-link" href={`/events/${event.id}`}>
                      View event →
                    </Link>
                  </article>
                ))}
            {page === "resources" &&
              i === 0 &&
              articles.map((article) => (
                <article className="event-row" key={article.slug}>
                  <div>
                    <h3>
                      <Link href={`/resources/${article.slug}`}>
                        {article.published.title}
                      </Link>
                    </h3>
                    <p>{article.published.intro}</p>
                  </div>
                  <Link
                    className="text-link"
                    href={`/resources/${article.slug}`}
                  >
                    Read →
                  </Link>
                </article>
              ))}
            {page === "contact" && i === 3 && (
              <fieldset
                disabled={readOnly}
                className="public-inquiry-container"
              >
                <PublicInquiry source="contact" />
              </fieldset>
            )}
            {page === "membership" && i === 1 && (
              <>
                <div className="plan-grid">
                  {["Patron", "Annual", "Life"].map((plan) => (
                    <article className="plan-card" key={plan}>
                      <span className="eyebrow">TPA MEMBERSHIP</span>
                      <h3>{plan}</h3>
                      <p>
                        Benefits, fee and eligibility awaiting confirmation.
                      </p>
                      <Link className="text-link" href="/join">
                        Preview application →
                      </Link>
                    </article>
                  ))}
                </div>
                <p>
                  Choose plan → Details → Documents → Payment → Association
                  review → Approval & membership number.
                </p>
              </>
            )}
            {page === "resources" && i === 3 && (
              <div className="resource-row">
                <div>
                  {(context.importantLinks??[]).map(({id,published:link}) => (
                    <p key={id}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        {link.title} ↗
                      </a>
                      {link.description&&<small>{link.description}</small>}
                    </p>
                  ))}
                </div>
              </div>
            )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
export function ArticleContentView({ body, breadcrumbs = false }: { body: ContentBody; breadcrumbs?: boolean }) {
  return (
    <main id="main" className="page-content">
      {breadcrumbs && <PublicBreadcrumbs section="Resources" href="/resources" title={body.title} />}
      <span className="eyebrow">TPA RESOURCES</span>
      <h1
        className={
          body.titleSize ? `content-title-${body.titleSize}` : undefined
        }
      >
        {body.title}
      </h1>
      <RichContent document={body.introRich} text={body.intro} />
      {body.sections.map((s, i) => (
        <section id={`section-${i}`} className="content-section" key={i}>
          <h2
            className={s.titleSize ? `content-title-${s.titleSize}` : undefined}
          >
            {s.title}
          </h2>
          <RichContent document={s.rich} text={s.text} />
        </section>
      ))}
      {body.sourceUrl && (
        <p>
          {body.attribution} ·{" "}
          <a href={body.sourceUrl} rel="noopener noreferrer">
            Original source ↗
          </a>
        </p>
      )}
    </main>
  );
}
