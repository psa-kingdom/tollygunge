import { publicHistoricalEvents } from "@/lib/public-historical-events";
import { HomepageEventsView, type HomeEvent } from "./homepage-events-view";
import { getDatabase } from "@/lib/database";
import { homeDefaults } from "@/domain/website-home";

export async function HomepageEvents({
  heading,
  copy,
  newsletter,
}: {
  heading?: string;
  copy?: typeof homeDefaults.eventContent;
  newsletter?: typeof homeDefaults.newsletterContent;
} = {}) {
  const events: HomeEvent[] = process.env.DATABASE_URL
    ? (
        await getDatabase().query<HomeEvent>(
          "SELECT id,title,starts_at,location FROM tpa.events WHERE status='published' AND visibility='public' ORDER BY starts_at DESC,id LIMIT 3",
        )
      ).rows
    : [];
  return (
    <HomepageEventsView
      events={events}
      pastEvents={await publicHistoricalEvents()}
      heading={heading}
      copy={copy}
      newsletter={newsletter}
    />
  );
}
