import "server-only";
import { getDatabase } from "./database";
import type { ContentBody } from "@/domain/operations";
export async function publishedPage(slug: string): Promise<ContentBody | null> {
  if (!process.env.DATABASE_URL) return null;
  const { rows } = await getDatabase().query(
    "SELECT published FROM tpa.content_entries WHERE slug=$1 AND kind='page' AND published IS NOT NULL AND archived_at IS NULL",
    [slug],
  );
  return rows[0]?.published ?? null;
}
export async function publishedArticles() {
  if (!process.env.DATABASE_URL) return [];
  return (
    await getDatabase().query(
      "SELECT slug,kind,published,published_at FROM tpa.content_entries WHERE kind IN ('insight','news') AND published IS NOT NULL AND archived_at IS NULL ORDER BY coalesce((published->>'displayOrder')::int,0),published_at DESC,slug",
    )
  ).rows as {
    slug: string;
    kind: string;
    published: ContentBody;
    published_at: Date;
  }[];
}
