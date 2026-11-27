import { hasPermission } from "@/domain/access";
import { text, uuid, version } from "@/domain/operations";
import { authorized, operation, OperationError } from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { eventRoster } from "@/lib/event-roster";
import { membershipPlans } from "@/lib/membership-plans";
import { recordRegistrationPayment } from "@/lib/finance";
import { paymentProofForm, paymentProofTransaction } from "@/lib/finance-upload";

export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "events:manage");
    const canRecordPayment = hasPermission(actor.roles, "payments:manage");
    const key = new URL(request.url).searchParams.get("eventKey") || "";
    const rows = await eventRoster(getDatabase(), key);
    if (
      /^[a-f0-9-]{36}$/i.test(key) &&
      canRecordPayment
    ) {
      const receipts = (
        await getDatabase().query(
          `SELECT DISTINCT ON (f.registration_id) f.registration_id,f.method,f.reference,f.source,f.note,p.id AS proof_id
           FROM tpa.finance_entries f LEFT JOIN tpa.finance_proofs p ON p.entry_id=f.id
           WHERE f.event_id=$1 AND f.kind='receipt' AND f.registration_id IS NOT NULL AND f.status<>'superseded'
           ORDER BY f.registration_id,(f.status='approved') DESC,f.created_at DESC,f.id`,
          [key],
        )
      ).rows;
      for (const row of rows) {
        const receipt = receipts.find(
          (receipt) => receipt.registration_id === row.id,
        );
        if (row.live && receipt) {
          row.live.payment_method = receipt.method;
          row.live.payment_reference = receipt.reference;
          row.live.receipt_source = receipt.source;
          row.live.payment_note = receipt.note;
          row.live.payment_proof_id = receipt.proof_id;
        }
      }
    }
    return { rows, plans: await membershipPlans(true), canRecordPayment };
  });
}

export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "events:manage", true);
    if (!hasPermission(actor.roles, "payments:manage"))
      throw new OperationError("Payment recording requires payments access.", 403);
    const { input, file } = await paymentProofForm(request);
    const note = text(input.note ?? "", "Remark", 1000);
    if (!note && !(file instanceof File && file.size > 0))
      throw new OperationError("Add a remark or attach payment proof.");
    const eventId = uuid(input.eventId);
    const registrationId = uuid(input.registrationId);
    const registrationVersion = version(input.version);
    return paymentProofTransaction(file, false, async (client, attach) => {
      const payment = await recordRegistrationPayment(client, actor, {
        eventId, registrationId, source: "admin", note, version: registrationVersion,
      });
      await attach(payment.id, actor.id);
      return { saved: true };
    });
  });
}
