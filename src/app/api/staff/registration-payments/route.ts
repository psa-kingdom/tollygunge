import { getDatabase } from "@/lib/database";
import {
  authorized,
  operation,
  OperationError,
} from "@/lib/operation-api";
import { uuid } from "@/domain/operations";
export async function GET(r: Request) {
  return operation(async () => {
    await authorized(r, "payments:manage");
    const eventValue=new URL(r.url).searchParams.get("eventId"), eventId=eventValue?uuid(eventValue):null;
    const state = new URL(r.url).searchParams.get("status") || "pending";
    if (
      !["all", "pending", "paid", "failed", "refunded", "cancelled"].includes(
        state,
      )
    )
      throw new OperationError("Choose a payment status.");
    return (
      await getDatabase().query(
        "SELECT r.*,coalesce((SELECT jsonb_agg(h ORDER BY h.created_at) FROM tpa.event_payment_history h WHERE h.registration_id=r.id),'[]'::jsonb) AS history,e.title,u.name,u.email,m.membership_number FROM tpa.event_registrations r JOIN tpa.events e ON e.id=r.event_id JOIN public.\"user\" u ON u.id=r.user_id LEFT JOIN tpa.people p ON p.user_id=u.id LEFT JOIN tpa.memberships m ON m.person_id=p.id WHERE ($2::uuid IS NULL OR r.event_id=$2) AND r.fee_paise>0 AND ($1='all' OR r.payment_status=$1) ORDER BY r.registered_at DESC LIMIT 250",
        [state,eventId],
      )
    ).rows;
  });
}
export async function POST(r: Request) {
 return operation(async()=>{await authorized(r,"payments:manage",true);throw new OperationError("Use Finance to submit a receipt or refund, or review a member proof.",409);});
}
