import { currentActor } from "@/lib/actor";
import { getDatabase } from "@/lib/database";
import { canReadPrivateDocument } from "@/domain/access";
import { privateDocumentDownload } from "@/lib/private-storage";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await currentActor(request.headers);
  if (!actor)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))
    return Response.json({ error: "Document not found." }, { status: 404 });
  const { rows } = await getDatabase().query(
    "SELECT owner_user_id FROM tpa.private_documents WHERE id=$1",
    [id],
  );
  if (!rows[0] || !canReadPrivateDocument(actor, rows[0].owner_user_id))
    return Response.json({ error: "Document not found." }, { status: 404 });
  try {
    const url = await privateDocumentDownload(id);
    await getDatabase().query(
      "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,$2,$3)",
      [
        actor.id,
        actor.id === rows[0].owner_user_id
          ? "document.downloaded"
          : "document.reviewed",
        id,
      ],
    );
    return new Response(null, {
      status: 303,
      headers: {
        Location: url,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return Response.json(
      { error: "Download is temporarily unavailable." },
      { status: 503 },
    );
  }
}
