import { publishedPeople } from "@/lib/public-people";
import "server-only";
import { getDatabase } from "./database";
import { publishedArticles } from "./public-content";
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
            "SELECT id,published,width,height FROM tpa.public_media WHERE published IS NOT NULL ORDER BY created_at DESC LIMIT 100",
          )
        ).rows
      : [];
  const events =
    page === "events"
      ? (
          await db.query(
            "SELECT id,title,starts_at,ends_at,location FROM tpa.events WHERE status='published' ORDER BY starts_at DESC LIMIT 100",
          )
        ).rows
      : [];
  return {
    ...emptyContentContext,
    people,
    media,
    events,
    articles: page === "resources" ? await publishedArticles() : [],
  };
}
