import { authorized, operation } from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { uuid } from '@/domain/operations';
import { eventPaymentAccess } from '@/lib/event-payment-access';
export async function GET(request: Request) {
  return operation(async () => {
    const actor=await authorized(request);
    const eventId=new URL(request.url).searchParams.get('eventId');
    if(eventId) return {collectionEnabled:true,...await eventPaymentAccess(uuid(eventId),actor)};
    return {
      collectionEnabled: false,
      records: (
        await getDatabase().query(
          "SELECT id,active_snapshot AS details FROM tpa.payment_details WHERE status='active' ORDER BY updated_at DESC",
        )
      ).rows,
    };
  });
}
