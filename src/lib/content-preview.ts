import { publishedPeople } from "@/lib/public-people";
import "server-only";
import { getDatabase } from "./database";
import { publishedArticles } from "./public-content";
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
  const media =
    page === "resources"
      ? (
          await db.query(
            "SELECT id,published,width,height FROM tpa.public_media WHERE published IS NOT NULL ORDER BY coalesce((published->>'displayOrder')::int,0),created_at DESC,id",
          )
        ).rows
      : [];
  const events =
    page === "events"
      ? (
          await db.query(
            "SELECT id,title,starts_at,ends_at,location FROM tpa.events WHERE status='published' AND visibility='public' ORDER BY starts_at DESC LIMIT 100",
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
    articles: page === "resources" ? await publishedArticles() : [],
  };
}
