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
    ? (
        await db.query(
          "SELECT g.id,g.published,(m.published IS NOT NULL) AS portrait_available,m.published->>'altText' AS portrait_alt FROM tpa.governance_profiles g LEFT JOIN tpa.public_media m ON m.id=g.published_portrait_id WHERE g.published IS NOT NULL ORDER BY (g.published->>'order')::int,g.published->>'name',g.id",
        )
      ).rows
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
