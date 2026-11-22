import { uuid } from "@/domain/operations";
import { hasPermission } from "@/domain/access";
import { currentActor } from "@/lib/actor";
import { getDatabase } from "@/lib/database";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let id: string;
  try { id = uuid((await params).id); } catch { return new Response(null, { status: 404 }); }
  const actor = await currentActor(request.headers);
  const { rows: [banner] } = await getDatabase().query(
    `SELECT b.content_type,b.image FROM tpa.event_banners b JOIN tpa.events e ON e.id=b.event_id
     WHERE e.id=$1 AND ($2 OR (e.status='published' AND
       (e.visibility='public' OR EXISTS(
         SELECT 1 FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id
         WHERE p.user_id=$3 AND m.status='active'
         AND (m.valid_from IS NULL OR m.valid_from<=current_date)
         AND (m.valid_until IS NULL OR m.valid_until>=current_date)
       ))) OR EXISTS (SELECT 1 FROM tpa.event_registrations r WHERE r.event_id=e.id AND r.user_id=$3))`,
    [id, Boolean(actor && hasPermission(actor.roles, "events:manage")), actor?.id ?? null],
  );
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!banner) return new Response(null, { status: 404, headers });
  return new Response(new Uint8Array(banner.image), {
    headers: { ...headers, "Content-Type": banner.content_type },
  });
}
