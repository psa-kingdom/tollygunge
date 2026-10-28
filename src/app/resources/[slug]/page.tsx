import { ArticleContentView } from "@/components/public-content-view";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { getDatabase } from "@/lib/database";
import type { ContentBody } from "@/domain/operations";
import { publicMetadata } from "@/domain/public-metadata";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = (await getDatabase().query(
    "SELECT published->>'title' title,published->>'intro' intro FROM tpa.content_entries WHERE slug=$1 AND kind IN ('news','insight') AND published IS NOT NULL AND archived_at IS NULL",
    [slug],
  )).rows[0];
  return row ? publicMetadata(`/resources/${encodeURIComponent(slug)}`, row.title, row.intro) : { title: "Resource not found", robots: { index: false, follow: false } };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = (
    await getDatabase().query(
      "SELECT published FROM tpa.content_entries WHERE slug=$1 AND kind IN ('news','insight') AND published IS NOT NULL AND archived_at IS NULL",
      [slug],
    )
  ).rows[0];
  if (!row) notFound();
  const body = row.published as ContentBody;
  return (
    <SiteShell>
      <ArticleContentView body={body} breadcrumbs />
    </SiteShell>
  );
}
