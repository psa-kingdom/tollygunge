import type { Metadata } from "next";

export const siteOrigin = "https://tpassociation.org";
export const associationName = "Tollygunge Professional Association";
export function plainDescription(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}
export function publicMetadata(path: string, title: string, description: string): Metadata {
  const url = new URL(path, siteOrigin).href;
  const summary = plainDescription(description);
  return {
    title, description: summary, alternates: { canonical: url },
    openGraph: { title, description: summary, url, siteName: associationName, type: "website", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: associationName }] },
    twitter: { card: "summary_large_image", title, description: summary, images: ["/opengraph-image"] },
  };
}
export function safeJsonLd(value: unknown) { return JSON.stringify(value).replaceAll("<", "\\u003c"); }
