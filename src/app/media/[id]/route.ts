import { uuid } from "@/domain/operations";
import { currentActor } from "@/lib/actor";
import { hasPermission } from "@/domain/access";
import { getDatabase } from "@/lib/database";
import { readEditorialMedia } from "@/lib/private-storage";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let id;
  try {
    id = uuid((await params).id);
  } catch {
    return new Response(null, { status: 404 });
  }
  const result = await getDatabase().query(
    "SELECT published FROM tpa.public_media WHERE id=$1",
    [id],
  );
  if (!result.rowCount) return new Response(null, { status: 404 });
  if (!result.rows[0].published) {
    const actor = await currentActor(request.headers);
    if (!actor || !hasPermission(actor.roles, "content:publish"))
      return new Response(null, { status: 404 });
  }
  try {
    const bytes = await readEditorialMedia(id);
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
