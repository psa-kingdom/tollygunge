import { peopleFallback } from "@/domain/people-placement";
import { publishedPeople } from "@/lib/public-people";
import { PublicContentView } from "@/components/public-content-view";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { publishedPage, publishedArticles } from "@/lib/public-content";
import { getDatabase } from "@/lib/database";
import { type PublicGovernanceEntry } from "@/components/public-governance";
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
      <PublicContentView
        page={page}
        data={data}
        context={{ people, media, events, articles }}
      />
    </SiteShell>
  );
}
