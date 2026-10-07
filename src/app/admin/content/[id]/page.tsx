import { sitePages } from "@/domain/site-pages";
import {
  PublicContentView,
  ArticleContentView,
} from "@/components/public-content-view";
import { previewContext } from "@/lib/content-preview";
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
      "SELECT draft,slug,kind FROM tpa.content_entries WHERE id=$1",
      [id],
    )
  ).rows[0];
  if (!row) notFound();
  const body = row.draft as ContentBody;
  return (
    <div className="workspace-main">
      <p className="notice">
        Private saved draft · only content staff can view this preview.
      </p>
      <Link href="/admin/workspaces/content">← Content workspace</Link>
      <div className="public-shell saved-content-preview">
        {row.kind === "page" ? (
          <PublicContentView
            readOnly
            page={row.slug}
            data={{ ...body, label: sitePages[row.slug]?.label }}
            context={await previewContext(row.slug)}
          />
        ) : (
          <ArticleContentView body={body} />
        )}
      </div>
    </div>
  );
}
