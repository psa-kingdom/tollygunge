import Link from "next/link";
import Image from "next/image";
import { PublicInquiry } from "./public-inquiry";
import {
  PublicGovernance,
  type PublicGovernanceEntry,
} from "./public-governance";
import { RichContent } from "./rich-content";
import type { ContentBody } from "@/domain/operations";
export type PublicContentContext = {
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
  return (
    <main id="main">
      <div className="page-heading">
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
      <div className="content-page">
        {data.sections.map((section, i) => (
          <section
            id={`section-${i}`}
            className="content-section"
            key={section.title}
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
            <RichContent document={section.rich} text={section.text} />
            {((page === "about" && i === 2) ||
              (page === "governance" && i < 2)) && (
              <PublicGovernance
                entries={people.filter(
                  (person) =>
                    person.published.group ===
                    (page === "about"
                      ? "founding"
                      : i === 0
                        ? "executive"
                        : "subcommittee"),
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
                  {[
                    ["Income Tax", "https://www.incometax.gov.in/"],
                    ["GST", "https://www.gst.gov.in/"],
                    ["MCA / ROC", "https://www.mca.gov.in/"],
                    ["ICAI", "https://www.icai.org/"],
                    ["ICSI", "https://www.icsi.edu/"],
                    ["RBI", "https://www.rbi.org.in/"],
                    ["SEBI", "https://www.sebi.gov.in/"],
                    ["EPFO", "https://www.epfindia.gov.in/"],
                    ["ESIC", "https://www.esic.gov.in/"],
                    ["DGFT", "https://www.dgft.gov.in/"],
                    ["Government Portals", "https://www.india.gov.in/"],
                    ["West Bengal Government", "https://wb.gov.in/"],
                  ].map(([label, url]) => (
                    <p key={label}>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        {label} ↗
                      </a>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
export function ArticleContentView({ body }: { body: ContentBody }) {
  return (
    <main id="main" className="page-content">
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
