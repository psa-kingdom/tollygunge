import { currentActor } from "@/lib/actor";
import { staffPeople } from "@/lib/people-service";
import { getDatabase } from "@/lib/database";
import {
  portraitStorage,
  privateStorageConfigured,
} from "@/lib/private-storage";
import { uuid } from "@/domain/operations";
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
  const db = getDatabase();
  const row = (
    await db.query(
      "SELECT p.person_id,u.user_id,EXISTS(SELECT 1 FROM tpa.people pub WHERE pub.published->>'portraitId'=p.id::text AND pub.published->>'portraitKind'='profile') AS visible FROM tpa.profile_portraits p JOIN tpa.people u ON u.id=p.person_id WHERE p.id=$1",
      [id],
    )
  ).rows[0];
  if (!row) return new Response(null, { status: 404 });
  const actor = await currentActor(request.headers);
  if (
    !row.visible &&
    (!actor || (row.user_id !== actor.id && !staffPeople(actor)))
  )
    return new Response(null, { status: 404 });
  if (!privateStorageConfigured()) return new Response(null, { status: 503 });
  try {
    const bytes = await portraitStorage(id, "read");
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": "image/webp",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
