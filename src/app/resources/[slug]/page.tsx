import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { getDatabase } from "@/lib/database";
import type { ContentBody } from "@/domain/operations";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = (
    await getDatabase().query(
      "SELECT published FROM tpa.content_entries WHERE slug=$1 AND kind IN ('news','insight') AND published IS NOT NULL",
      [slug],
    )
  ).rows[0];
  if (!row) notFound();
  const body = row.published as ContentBody;
  return (
    <SiteShell>
      <main id="main" className="page-content">
        <span className="eyebrow">TPA RESOURCES</span>
        <h1>{body.title}</h1>
        <p>{body.intro}</p>
        {body.sections.map((s, i) => (
          <section className="content-section" key={i}>
            <h2>{s.title}</h2>
            <p className="prose-text">{s.text}</p>
          </section>
        ))}
        {body.sourceUrl && (
          <p>
            {body.attribution} ·{" "}
            <a href={body.sourceUrl} rel="noopener noreferrer">
              Original source ↗
            </a>
          </p>
        )}
      </main>
    </SiteShell>
  );
}
