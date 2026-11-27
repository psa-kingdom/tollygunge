import { HomeView } from "@/components/homepage-view";
import { HomepageEvents } from "@/components/homepage-events";
import { SiteShell } from "@/components/site-shell";
import { publicMetadata, safeJsonLd, siteOrigin } from "@/domain/public-metadata";
import { getDatabase } from "@/lib/database";
import { publishedSettings } from "@/lib/website-content";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const shared = await publishedSettings("shared");
  return {
    ...publicMetadata("/", shared.defaultTitle, shared.defaultDescription),
    title: { absolute: shared.defaultTitle },
  };
}

export default async function Home() {
  const [home, shared, nextEvent] = await Promise.all([
    publishedSettings("home"),
    publishedSettings("shared"),
    process.env.DATABASE_URL
      ? getDatabase().query<{ id: string; title: string }>(
          `SELECT id, title FROM tpa.events
           WHERE status = 'published' AND visibility = 'public'
             AND starts_at > now() AND completed_at IS NULL AND archived_at IS NULL
           ORDER BY starts_at, id LIMIT 1`,
        )
      : undefined,
  ]);

  return (
    <SiteShell variant="v3">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: shared.organisation.replace(/\s+/g, " ").trim(),
            url: siteOrigin,
            logo: `${siteOrigin}/design/tpa-logo.png`,
          }),
        }}
      />
      <HomeView
        home={home}
        brandMark={shared.brandMark}
        upcomingEvent={nextEvent?.rows[0]}
        events={
          <HomepageEvents
            heading={home.copy.sectionHeading37}
            copy={home.eventContent}
            newsletter={home.newsletterContent}
          />
        }
      />
    </SiteShell>
  );
}
