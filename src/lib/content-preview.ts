import { publishedPeople } from "@/lib/public-people";
import "server-only";
import { publicHistoricalEvents } from "./public-historical-events";
import { getDatabase } from "./database";
import { publishedArticles, publishedGalleryMedia } from "./public-content";
import {publishedSettings,publishedResources} from './website-content';
import {sitePages} from '@/domain/site-pages';
import {peopleFallback} from '@/domain/people-placement';
import {
  emptyContentContext,
  type PublicContentContext,
} from "@/components/public-content-view";
export async function previewContext(
  page: string,
): Promise<PublicContentContext> {
  const db = getDatabase();
  const people = ["about", "governance"].includes(page)
    ? await publishedPeople()
    : [];
  const media = page === "resources" ? await publishedGalleryMedia(4) : [];
  const events =
    page === "events"
      ? (
          await db.query(
            "SELECT id,title,starts_at,ends_at,location,EXISTS(SELECT 1 FROM tpa.event_banners b WHERE b.event_id=events.id) AS has_banner FROM tpa.events WHERE status='published' AND visibility='public' ORDER BY starts_at DESC LIMIT 100",
          )
        ).rows
      : [];
  return {
    defaultPage:sitePages[page]?peopleFallback(page,{...sitePages[page],sourceUrl:'',attribution:'',sections:sitePages[page].sections.map(s=>({...s}))},people):undefined,
    biographyTemplate:(await publishedSettings('shared')).biographyHeading,
    importantLinks:page==='resources'?await publishedResources('link'):[],downloads:page==='resources'?await publishedResources('document'):[],
    ...emptyContentContext,
    people,
    media,
    events,
    pastEvents: page === "events" ? await publicHistoricalEvents() : [],
    articles: page === "resources" ? await publishedArticles(4) : [],
  };
}
