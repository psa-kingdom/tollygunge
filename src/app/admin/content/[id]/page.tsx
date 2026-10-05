import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/actor";
import { hasPermission } from "@/domain/access";
import { getDatabase } from "@/lib/database";
import { uuid, type ContentBody } from "@/domain/operations";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Private content preview",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!hasPermission(actor.roles, "content:publish")) notFound();
  const { id } = await params;
  try {
    uuid(id);
  } catch {
    notFound();
  }
  const row = (
    await getDatabase().query(
      "SELECT draft FROM tpa.content_entries WHERE id=$1",
      [id],
    )
  ).rows[0];
  if (!row) notFound();
  const body = row.draft as ContentBody;
  return (
    <main id="main" className="workspace-main">
      <p className="notice">
        Private saved draft · only content staff can view this preview.
      </p>
      <Link href="/admin/workspaces/content">← Content workspace</Link>
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
  );
}
