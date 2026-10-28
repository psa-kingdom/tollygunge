import type { MetadataRoute } from "next";
import { siteOrigin } from "@/domain/public-metadata";
import { sitePages } from "@/domain/site-pages";
import { getDatabase } from "@/lib/database";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = ["/", ...Object.keys(sitePages).map(key => `/${key}`), "/privacy"].map(path => ({ url: new URL(path, siteOrigin).href }));
  if (!process.env.DATABASE_URL) return pages;
  const [events, resources] = await Promise.all([
    getDatabase().query("SELECT id FROM tpa.events WHERE status='published' AND visibility='public' AND archived_at IS NULL ORDER BY id"),
    getDatabase().query("SELECT slug,published_at FROM tpa.content_entries WHERE kind IN ('news','insight') AND published IS NOT NULL AND archived_at IS NULL ORDER BY slug"),
  ]);
  return [...pages, ...events.rows.map(row => ({ url: `${siteOrigin}/events/${encodeURIComponent(row.id)}` })), ...resources.rows.map(row => ({ url: `${siteOrigin}/resources/${encodeURIComponent(row.slug)}`, ...(row.published_at ? { lastModified: new Date(row.published_at) } : {}) }))];
}
