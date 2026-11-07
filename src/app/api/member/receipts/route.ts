import { authorized, operation } from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { uuid } from "@/domain/operations";
import { receiptUpload } from "@/lib/finance-upload";
export async function GET(r: Request) {
  return operation(async () => {
    const actor = await authorized(r),
      eventId = uuid(new URL(r.url).searchParams.get("eventId"));
    return (
      await getDatabase().query(
        `SELECT f.id,f.label,f.amount_paise,f.entry_date::text AS entry_date,f.status,f.reference,f.review_note,f.created_at,p.id AS proof_id FROM tpa.finance_entries f JOIN tpa.event_registrations r ON r.id=f.registration_id LEFT JOIN tpa.finance_proofs p ON p.entry_id=f.id WHERE f.event_id=$1 AND r.user_id=$2 ORDER BY f.created_at DESC`,
        [eventId, actor.id],
      )
    ).rows;
  });
}
export async function POST(r: Request) {
  return operation(() => receiptUpload(r, true));
}
