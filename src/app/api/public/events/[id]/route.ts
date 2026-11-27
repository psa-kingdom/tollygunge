import { getDatabase } from "@/lib/database";
import { uuid } from "@/domain/operations";
import { operation, OperationError } from "@/lib/operation-api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return operation(async () => {
    const { id } = await params;
    const { rows: [event] } = await getDatabase().query(
      `SELECT id,title,description,location,starts_at,ends_at,organiser,cpe_hours,speakers,
       fee_paise,status,booking_closed,completed_at,archived_at,registration_starts_at,registration_ends_at,
       (starts_at>now() AND completed_at IS NULL AND archived_at IS NULL AND
         EXISTS(SELECT 1 FROM tpa.event_banners b WHERE b.event_id=e.id)) AS has_banner
       FROM tpa.events e WHERE id=$1 AND status='published' AND visibility='public'`,
      [uuid(id)],
    );
    if (!event) throw new OperationError("Event not found.", 404);
    return event;
  });
}
