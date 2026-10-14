import { uuid } from "@/domain/operations";
import { getDatabase } from "@/lib/database";
import { websiteFileStorage } from "@/lib/private-storage";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let id;
  try {
    id = uuid((await params).id);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const row = (
    await getDatabase().query(
      "SELECT f.id FROM tpa.website_resources r JOIN tpa.website_resource_files f ON f.resource_id=r.id AND f.id::text=r.published->>'fileId' WHERE r.id=$1 AND r.kind='document' AND r.published IS NOT NULL AND r.archived_at IS NULL",
      [id],
    )
  ).rows[0];
  if (!row)
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  try {
    const bytes = await websiteFileStorage(row.id, "read");
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="tpa-document.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Download unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
