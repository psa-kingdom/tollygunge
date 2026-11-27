import "server-only";
import { cache } from "react";
import { getDatabase } from "./database";
import {
  websiteDefaults,
  type SettingsKey,
  type SharedSettings,
} from "@/domain/website-settings";
export const publishedSettings = cache(
  async <K extends SettingsKey>(
    key: K,
  ): Promise<(typeof websiteDefaults)[K]> => {
    if (!process.env.DATABASE_URL) return websiteDefaults[key];
    const row = (
      await getDatabase().query(
        "SELECT published FROM tpa.website_settings WHERE key=$1",
        [key],
      )
    ).rows[0];
    const value = row?.published;
    return value ? { ...websiteDefaults[key], ...value } : websiteDefaults[key];
  },
);
export async function publicNavigation() {
  const settings = await publishedSettings("shared");
  if (!process.env.DATABASE_URL) return settings.navigation;
  const pages = (
    await getDatabase().query(
      "SELECT slug,published FROM tpa.content_entries WHERE kind='page' AND published IS NOT NULL AND archived_at IS NULL",
    )
  ).rows;
  return settings.navigation.map((n) => {
    const page = pages.find((p) => "/" + p.slug === n.href);
    const links: string[] = page ? page.published.sections.map((s: { title: string }) => s.title) : n.links;
    if (n.href === "/resources")
      return { ...n, title: "Media", links: links.map((title, index) => index === 1 ? "Gallery" : title) };
    return { ...n, links };
  }) as SharedSettings["navigation"];
}
export const publishedResources = cache(async function publishedResources(kind: "link" | "document") {
  if (!process.env.DATABASE_URL) return [];
  return (
    await getDatabase().query(
      "SELECT id,published FROM tpa.website_resources WHERE kind=$1 AND published IS NOT NULL AND archived_at IS NULL ORDER BY (published->>'order')::int,id",
      [kind],
    )
  ).rows;
});
