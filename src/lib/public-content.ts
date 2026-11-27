import "server-only";
import { cache } from "react";
import { getDatabase } from "./database";
import type { ContentBody } from "@/domain/operations";
import type { ResourceImage } from "@/components/resource-collections";
export const publishedPage = cache(async function publishedPage(slug: string): Promise<ContentBody | null> {
  if (!process.env.DATABASE_URL) return null;
  const { rows } = await getDatabase().query(
    "SELECT published FROM tpa.content_entries WHERE slug=$1 AND kind='page' AND published IS NOT NULL AND archived_at IS NULL",
    [slug],
  );
  return rows[0]?.published ?? null;
});
export async function publishedArticles(limit?: number) {
  if (!process.env.DATABASE_URL) return [];
  return (
    await getDatabase().query(
      "SELECT slug,kind,published,published_at FROM tpa.content_entries WHERE kind IN ('insight','news') AND published IS NOT NULL AND archived_at IS NULL ORDER BY published_at DESC NULLS LAST,slug LIMIT $1",
      [limit ?? null],
    )
  ).rows as {
    slug: string;
    kind: string;
    published: ContentBody;
    published_at: Date;
  }[];
}

export async function publishedMedia(limit?: number) {
  if (!process.env.DATABASE_URL) return [];
  return (await getDatabase().query<ResourceImage>(
    "SELECT id,published,width,height FROM tpa.public_media WHERE published IS NOT NULL ORDER BY created_at DESC,id LIMIT $1",
    [limit ?? null],
  )).rows;
}
