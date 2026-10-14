import { uuid } from "@/domain/operations";
import { hasPermission } from "@/domain/access";
import { currentActor } from "@/lib/actor";
import { getDatabase } from "@/lib/database";
import { paymentQrStorage } from "@/lib/private-storage";
import { eventPaymentAccess } from '@/lib/event-payment-access';
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await currentActor(request.headers);
  if (!actor) return new Response(null, { status: 401 });
  let id;
  try {
    id = uuid((await params).id);
  } catch {
    return new Response(null, { status: 404 });
  }
  const exists = await getDatabase().query(
    "SELECT 1 FROM tpa.payment_qr_images WHERE id=$1",
    [id],
  );
  if (!exists.rowCount) return new Response(null, { status: 404 });
  const eventId=new URL(request.url).searchParams.get('eventId');
  if(eventId) {
    try {
      const result=await eventPaymentAccess(uuid(eventId),actor);
      if(!result.records.some((r:{details:{qrId?:string}})=>r.details.qrId===id)) return new Response(null,{status:404});
      const bytes=await paymentQrStorage(id,'read');
      return new Response(bytes as BodyInit,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
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
    const bytes = await paymentQrStorage(id, "read");
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
