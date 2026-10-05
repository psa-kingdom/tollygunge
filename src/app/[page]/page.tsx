import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { publishedPage, publishedArticles } from "@/lib/public-content";
import { getDatabase } from "@/lib/database";
import { PublicInquiry } from "@/components/public-inquiry";
import {
  PublicGovernance,
  type PublicGovernanceEntry,
} from "@/components/public-governance";
export const dynamic = "force-dynamic";
import { sitePages as pages } from "@/domain/site-pages";
export function generateStaticParams() {
  return Object.keys(pages).map((page) => ({ page }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  if (!pages[page]) return { title: "Page not found" };
  return { title: (await publishedPage(page))?.title ?? pages[page].title };
}
export default async function ContentPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const fallback = pages[page];
  if (!fallback) notFound();
  const live = await publishedPage(page);
  const data = live
    ? { ...fallback, ...live }
    : {
        ...fallback,
        sections: fallback.sections.map((section) => ({ ...section })),
      };
  const articles = page === "resources" ? await publishedArticles() : [];
  const people: PublicGovernanceEntry[] =
    ["about", "governance"].includes(page) && process.env.DATABASE_URL
      ? (
          await getDatabase().query(
            "SELECT g.id,g.published,(m.published IS NOT NULL) AS portrait_available,m.published->>'altText' AS portrait_alt FROM tpa.governance_profiles g LEFT JOIN tpa.public_media m ON m.id=g.published_portrait_id WHERE g.published IS NOT NULL ORDER BY (g.published->>'order')::int,g.published->>'name',g.id",
          )
        ).rows
      : [];
  if (!live && people.length) {
    if (
      page === "about" &&
      people.some((p) => p.published.group === "founding")
    )
      data.sections[2].text =
        "Meet the professionals who helped establish our association.";
    if (page === "governance") {
      if (people.some((p) => p.published.group === "executive"))
        data.sections[0].text =
          "Association-confirmed leadership profiles and responsibilities.";
      if (people.some((p) => p.published.group === "subcommittee"))
        data.sections[1].text =
          "Working groups and their association responsibilities.";
    }
  }
  const media =
    page === "resources" && process.env.DATABASE_URL
      ? (
          await getDatabase().query(
            "SELECT id,published,width,height FROM tpa.public_media WHERE published IS NOT NULL ORDER BY created_at DESC LIMIT 100",
          )
        ).rows
      : [];
  const events =
    page === "events" && process.env.DATABASE_URL
      ? (
          await getDatabase().query(
            "SELECT id,title,location,starts_at,ends_at FROM tpa.events WHERE status='published' ORDER BY starts_at DESC LIMIT 100",
          )
        ).rows
      : [];
  if (!live && page === "events") {
    data.sections[0].text = events.some(
      (event) => new Date(event.ends_at) > new Date(),
    )
      ? "Choose a published event to view its details and registration."
      : "No upcoming events are published yet.";
    if (events.some((event) => new Date(event.ends_at) <= new Date()))
      data.sections[1].text =
        "Explore completed events. Your own attendance history remains private in your member space.";
  }
  if (!live && page === "resources" && articles.length)
    data.sections[0].text =
      "Editorially reviewed association insights and attributed professional updates.";
  if (!live && page === "resources" && media.length)
    data.sections[1].text =
      "Editorially reviewed association images. Private application documents are excluded.";
  return (
    <SiteShell>
      <main id="main">
        <div className="page-heading">
          <span className="eyebrow">{data.label}</span>
          <h1>{data.title}</h1>
          <p>{data.intro}</p>
        </div>
        <div className="content-page">
          {data.sections.map((section, i) => (
            <section
              id={`section-${i}`}
              className="content-section"
              key={section.title}
            >
              <h2>{section.title}</h2>
              <p className="prose-text">{section.text}</p>
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
                <PublicInquiry source="contact" />
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
    </SiteShell>
  );
}
