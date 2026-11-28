import { uuid } from "@/domain/operations";
import { hasPermission } from "@/domain/access";
import { currentActor } from "@/lib/actor";
import { getDatabase } from "@/lib/database";
import { paymentQrStorage } from "@/lib/private-storage";
import { eventPaymentAccess } from '@/lib/event-payment-access';
import { bookingLabel } from "@/domain/event-flow";
import { eventOrganiserUpis } from "@/lib/organiser-upi";
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
  const query = new URL(request.url).searchParams;
  if (query.get("registration") === "1") {
    try {
      const eventId = uuid(query.get("eventId"));
      const { rows: [event] } = await getDatabase().query(
        "SELECT * FROM tpa.events WHERE id=$1 AND deleted_at IS NULL AND status='published' AND visibility='public' AND fee_paise>0",
        [eventId],
      );
      if (!event || bookingLabel(event) !== "Registration open" ||
          !(await eventOrganiserUpis(event)).some((account) => account.details.qrId === id))
        return new Response(null, { status: 404 });
      return await qrResponse(id);
    } catch {
      return new Response(null, { status: 404 });
    }
  }
  const actor = await currentActor(request.headers);
  if (!actor) return new Response(null, { status: 401 });
  const exists = await getDatabase().query(
    "SELECT 1 FROM tpa.payment_qr_images WHERE id=$1",
    [id],
  );
  if (!exists.rowCount) return new Response(null, { status: 404 });
  const eventId=query.get('eventId');
  if(eventId) {
    try {
      const result=await eventPaymentAccess(uuid(eventId),actor);
      if(!result.records.some((r:{details:{qrId?:string}})=>r.details.qrId===id)) return new Response(null,{status:404});
      return await qrResponse(id);
    } catch {return new Response(null,{status:404});}
  }
  if (
    !hasPermission(actor.roles, "payments:manage") &&
    !(
      await getDatabase().query(
        "SELECT 1 FROM tpa.payment_details WHERE status='active' AND active_snapshot->>'qrId'=$1",
        [id],
      )
    ).rowCount
  )
    return new Response(null, { status: 404 });
  try {
    return await qrResponse(id);
  } catch {
    return new Response(null, { status: 503 });
  }
}

async function qrResponse(id: string) {
  const bytes = await paymentQrStorage(id, "read");
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
