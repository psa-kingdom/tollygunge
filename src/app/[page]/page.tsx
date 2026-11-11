import { validEventDate, eventInDateRange } from "@/domain/event-date-range";
import { selectPublicEvents } from "@/domain/public-event-selection";
import { publicHistoricalEvents } from "@/lib/public-historical-events";
import { peopleFallback } from "@/domain/people-placement";
import { publishedPeople } from "@/lib/public-people";
import { PublicContentView } from "@/components/public-content-view";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { publishedPage, publishedArticles } from "@/lib/public-content";
import { getDatabase } from "@/lib/database";
import {publishedSettings,publishedResources} from '@/lib/website-content';
import { type PublicGovernanceEntry } from "@/components/public-governance";
export const dynamic = "force-dynamic";
import { sitePages as pages } from "@/domain/site-pages";
import { publicMetadata } from "@/domain/public-metadata";
export function generateStaticParams() {
  return Object.keys(pages).map((page) => ({ page }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  if (!pages[page]) return { title: "Page not found", robots: { index: false, follow: false } };
  const content = await publishedPage(page);
  return publicMetadata(`/${page}`, content?.title ?? pages[page].title, content?.intro || pages[page].intro);
}
export default async function ContentPage({
  params, searchParams,
}: {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ month?: string; from?: string; to?: string }>;
}) {
  const { page } = await params;
  const query = await searchParams;
  const requestedMonth = query.month;
  const from = validEventDate(query.from), to = validEventDate(query.to);
  const rangeError = !!(from && to && from > to);
  const month = typeof requestedMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : "";
  const fallback = pages[page];
  if (!fallback) notFound();
  const live = await publishedPage(page);
  const data = live
    ? { ...fallback, ...live }
    : {
        ...fallback,
        sourceUrl: "",
        attribution: "",
        sections: fallback.sections.map((section) => ({ ...section })),
      };
  const articles = page === "resources" ? await publishedArticles() : [];
  const people: PublicGovernanceEntry[] =
    ["about", "governance"].includes(page) && process.env.DATABASE_URL
      ? await publishedPeople()
      : [];
  if (!live) Object.assign(data, peopleFallback(page, data, people));
  const media =
    page === "resources" && process.env.DATABASE_URL
      ? (
          await getDatabase().query(
            "SELECT id,published,width,height FROM tpa.public_media WHERE published IS NOT NULL ORDER BY coalesce((published->>'displayOrder')::int,0),created_at DESC,id",
          )
        ).rows
      : [];
  const allEvents =
    page === "events" && process.env.DATABASE_URL
      ? (
          await getDatabase().query(
            "SELECT id,title,description,location,starts_at,ends_at FROM tpa.events WHERE status='published' AND visibility='public' AND ($1::text='' OR to_char(starts_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM')=$1) ORDER BY starts_at DESC", [month],
          )
        ).rows
      : [];
  const inRange = (date: string) => eventInDateRange(date, from, to);
  const history = page === "events" ? await publicHistoricalEvents(month) : [];
  const selection = selectPublicEvents(allEvents.filter(event => inRange(new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(event.starts_at)))), history.filter(event => inRange(event.date)), month, from || to ? null : 3);
  const events = selection.events, pastEvents = selection.historical;
  if (!live && page === "events") {
    data.sections[0].text = events.some(
      (event) => new Date(event.ends_at) > new Date(),
    )
      ? "Choose a published event to view its details and registration."
      : "No upcoming events are published yet.";
    if (pastEvents.length || events.some((event) => new Date(event.ends_at) <= new Date()))
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
      <PublicContentView
        page={page}
        data={data}
        context={{ eventFrom: from, eventTo: to, eventRangeError: rangeError, eventMonth: month, people, media, events, pastEvents, articles,biographyTemplate:(await publishedSettings('shared')).biographyHeading,importantLinks:page==='resources'?await publishedResources('link'):[],downloads:page==='resources'?await publishedResources('document'):[] }}
      />
    </SiteShell>
  );
}
