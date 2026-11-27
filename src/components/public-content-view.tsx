import { planTotal, defaultMembershipPlans, type MembershipPlanDetails } from "@/domain/membership-plans";
import { showMemberSection } from "@/domain/people-placement";
import type { PublicHistoricalEvent } from "@/lib/public-historical-events";
import { HistoricalEventCard } from "./historical-event-card";
import Link from "next/link";
import Image from "next/image";
import { PublicInquiry } from "./public-inquiry";
import { PublicBreadcrumbs } from "./public-breadcrumbs";
import {
  PublicGovernance,
  type PublicGovernanceEntry,
} from "./public-governance";
import { RichContent } from "./rich-content";
import type { ContentBody } from "@/domain/operations";
import { eventTime } from "@/domain/event-flow";
import styles from "./public-events-hero.module.css";
export type PublicContentContext = {
  membershipPlans?: MembershipPlanDetails[];
  pastEvents?: PublicHistoricalEvent[];
  allPast?: boolean;
  defaultPage?: ContentBody;
  biographyTemplate?: string;
  importantLinks?: {
    id: string;
    published: { title: string; url: string; description: string };
  }[];
  downloads?: {
    id: string;
    published: {
      title: string;
      url: string;
      description: string;
      fileId: string | null;
    };
  }[];
  people: PublicGovernanceEntry[];
  media: {
    id: string;
    width: number;
    height: number;
    published: { title: string; altText: string; category: string };
  }[];
  events: {
    has_banner?: boolean;
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
  const upcoming = events.filter(event => new Date(event.ends_at) > new Date())
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const visibleSections = data.sections
    .map((section, i) => ({ section, i }))
    .filter(({ i }) => showMemberSection(page, i, people));
  const illustration =
    page === "membership" || page === "about"
      ? "/design/book-community-watercolor.webp"
      : page === "resources"
        ? "/design/book-knowledge-watercolor.webp"
        : undefined;
  return (
    <main id="main" className={`public-information public-page-${page}`}>
      <div className={`page-heading ${page === "events" ? styles.hero : ""}`}>
        <div className="page-heading-copy">
          <span
            className="eyebrow"
            data-cms-field={readOnly ? "label" : undefined}
          >
            {data.label}
          </span>
          <h1
            data-cms-field={readOnly ? "title" : undefined}
            className={
              data.titleSize ? `content-title-${data.titleSize}` : undefined
            }
          >
            {data.title}
          </h1>
          <div data-cms-field={readOnly ? "intro" : undefined}>
            <RichContent document={data.introRich} text={data.intro} />
          </div>
          {page === "membership" && (
            <Link className="button page-primary-action" href="/join">
              Start your application
            </Link>
          )}
          {page === "contact" && (
            <a className="button page-primary-action" href="#section-3">
              Send an inquiry
            </a>
          )}
        </div>
        {page === "events" ? (
          <section className={styles.upcoming} id="section-0" aria-labelledby="section-heading-0">
            <h2 id="section-heading-0" className={styles.sectionTitle}
              data-cms-field={readOnly ? "sections.0.title" : undefined}>
              {data.sections[0]?.title ?? "Upcoming events"}
            </h2>
            {upcoming.length ? upcoming.map(event => (
              <article className={styles.event} key={event.id}>
                {event.has_banner && (
                  <Link href={`/events/${event.id}`} className={styles.banner} aria-label={`View ${event.title}`}>
                    <Image unoptimized src={`/api/event-banners/${event.id}`} alt={`Banner for ${event.title}`}
                      width={1000} height={600} sizes="(max-width: 800px) 100vw, 50vw" />
                  </Link>
                )}
                <div className={styles.details}>
                  <time className={styles.date} dateTime={new Date(event.starts_at).toISOString()}>
                    {eventTime(event.starts_at)}
                  </time>
                  <h3><Link href={`/events/${event.id}`}>{event.title}</Link></h3>
                  {event.location && <p className={styles.location}>{event.location}</p>}
                  <Link className="button" href={`/events/${event.id}`}>View event &amp; register </Link>
                </div>
              </article>
            )) : (
              <div className={styles.empty}>
                <p data-cms-field={readOnly ? "sections.0.text" : undefined}>
                  {data.sections[0]?.text || "New events will appear here when registration opens."}
                </p>
              </div>
            )}
          </section>
        ) : (data.heroMediaId || illustration) && (
          <Image
            className="page-heading-art"
            data-cms-field={readOnly ? "heroMediaId" : undefined}
            src={
              data.heroMediaId ? `/media/${data.heroMediaId}` : illustration!
            }
            width={480}
            height={480}
            sizes="(max-width: 767px) 260px, 390px"
            alt={data.heroMediaId ? data.heroAlt || "" : ""}
            aria-hidden={!data.heroMediaId || undefined}
            unoptimized={Boolean(data.heroMediaId)}
          />
        )}
      </div>
      <div className="public-content-layout">
        <div className="content-page">
          {visibleSections.filter(({ i }) => page !== "events" || i !== 0).map(({ section, i }) => (
            <section
              id={`section-${i}`}
              className="content-section"
              aria-labelledby={`section-heading-${i}`}
              key={i}
            >
              <h2
                data-cms-field={readOnly ? `sections.${i}.title` : undefined}
                id={`section-heading-${i}`}
                className={
                  section.titleSize
                    ? `content-title-${section.titleSize}`
                    : undefined
                }
              >
                {section.title}
              </h2>
              <div className="public-section-body">
                {section.mediaId && (
                  <Image
                    unoptimized
                    src={`/media/${section.mediaId}`}
                    alt={section.mediaAlt || ""}
                    width={1000}
                    height={600}
                    style={{
                      width: "100%",
                      height: "auto",
                      borderRadius: 12,
                      marginBottom: 24,
                    }}
                  />
                )}
                <div
                  data-cms-field={readOnly ? `sections.${i}.text` : undefined}
                >
                  <RichContent document={section.rich} text={section.text} />
                </div>
                {["about", "governance"].includes(page) && (
                  <PublicGovernance
                    compact={page === "governance"}
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
                      <figure
                        key={asset.id}
                        data-cms-record={
                          readOnly ? `media:${asset.id}` : undefined
                        }
                      >
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
                {page === "resources" && i === 2 && (
                  <div className="resource-row">
                    {context.downloads?.map((resource) => (
                      <article key={resource.id}>
                        <h3>
                          <a
                            href={
                              resource.published.fileId
                                ? `/downloads/${resource.id}`
                                : resource.published.url
                            }
                          >
                            {resource.published.title}
                          </a>
                        </h3>
                        <p>{resource.published.description}</p>
                      </article>
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
                            <Link href={`/events/${event.id}`}>
                              {event.title}
                            </Link>
                          </h3>
                          <p>
                            {new Date(event.starts_at).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                            })}{" "}
                            IST · {event.location}
                          </p>
                        </div>
                        <Link
                          className="text-link"
                          href={`/events/${event.id}`}
                        >
                          View event
                        </Link>
                      </article>
                    ))}
                {page === "events" &&
                  i === 1 &&
                  context.pastEvents?.map((event) => (
                    <HistoricalEventCard key={event.date} event={event} />
                  ))}
                {page === "events" && i === 1 && !readOnly && (
                  <Link className="button secondary" href={context.allPast ? "/events#section-1" : "/events?past=all#section-1"}>
                    {context.allPast ? "Show recent events" : "View all past events"}
                  </Link>
                )}
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
                        Read
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
                      {(context.membershipPlans ?? defaultMembershipPlans).map((plan) => (
                        <article className="plan-card" key={plan.code}>
                          <span className="eyebrow">TPA MEMBERSHIP</span>
                          <h3>{plan.name}</h3>
                          <p>{plan.cost_configured ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(planTotal(plan) / 100) : "Cost awaiting publication"}</p>
                          {plan.benefits && <p className="prose-text">{plan.benefits}</p>}
                          {plan.code === "Free" && (
                            <Link className="text-link" href="/signup">Join TPA </Link>
                          )}
                        </article>
                      ))}
                    </div>
                    <div className="application-path">
                      <span className="page-index-label">
                        Your application journey
                      </span>
                      <ol>
                        {[
                          "Choose a plan",
                          "Add your details",
                          "Upload documents",
                          "Payment",
                          "Association review",
                          "Approval & membership number",
                        ].map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  </>
                )}
                {page === "resources" && i === 3 && (
                  <div className="resource-row">
                    <div>
                      {(context.importantLinks ?? []).map(
                        ({ id, published: link }) => (
                          <p key={id}>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {link.title}
                            </a>
                            {link.description && (
                              <small>{link.description}</small>
                            )}
                          </p>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
export function ArticleContentView({
  body,
  breadcrumbs = false,
}: {
  body: ContentBody;
  breadcrumbs?: boolean;
}) {
  return (
    <main id="main" className="page-content">
      {breadcrumbs && (
        <PublicBreadcrumbs
          section="Resources"
          href="/resources"
          title={body.title}
        />
      )}
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
            Original source
          </a>
        </p>
      )}
    </main>
  );
}
