import { hasPermission } from "@/domain/access";
import { randomUUID } from "node:crypto";
import {
  authorized,
  operation,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { paymentDetails } from "@/domain/payment-details";
import { eventOrganisers } from "@/domain/organiser-upi";

export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request);
    if (
      !hasPermission(actor.roles, "payments:manage") &&
      !hasPermission(actor.roles, "events:manage")
    )
      throw new OperationError("Access denied.", 403);
    return {
      records: (
        await getDatabase().query(
          "SELECT id,organiser,version,status,active_snapshot AS details FROM tpa.payment_details WHERE organiser IS NOT NULL AND status='active' ORDER BY organiser,updated_at DESC",
        )
      ).rows,
    };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "payments:manage", true);
    const body = await jsonBody(request, 4096);
    if (
      body.id &&
      (typeof body.id !== "string" || !Number.isInteger(body.version))
    )
      throw new OperationError("Choose a UPI record and its version.");
    if (body.action === "archive") {
      return transaction(async (client) => {
        const result = await client.query(
          "UPDATE tpa.payment_details SET status='past',version=version+1,updated_at=now() WHERE id::text=$1 AND version=$2 AND organiser IS NOT NULL AND status='active' RETURNING *",
          [body.id, body.version],
        );
        if (!result.rowCount)
          throw new OperationError(
            "This UPI record changed. Reload before removing.",
            409,
          );
        const row = result.rows[0];
        await client.query(
          "INSERT INTO tpa.payment_detail_revisions(detail_id,version,status,details,actor_user_id) VALUES($1,$2,'past',$3,$4)",
          [row.id, row.version, row.draft, actor.id],
        );
        await audit(client, actor.id, "organiser_upi.archived", row.id);
        return { saved: true };
      });
    }
    if (!eventOrganisers.includes(body.organiser))
      throw new OperationError("Choose TPA or CA CP Study Circle.");
    let details;
    try {
      details = {
        ...paymentDetails({
          method: "upi",
          label: body.organiser + " UPI",
          payee: body.payee,
          upiId: body.upiId,
          phone: "",
          qrId: null,
        }),
        organiser: body.organiser,
      };
    } catch (error) {
      throw new OperationError((error as Error).message);
    }
    return transaction(async (client) => {
      const id = body.id ?? randomUUID();
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,7621))",
        [JSON.stringify([body.organiser, details.upiId.toLowerCase()])],
      );
      const duplicate = (
        await client.query(
          "SELECT id,version,active_snapshot FROM tpa.payment_details WHERE organiser=$1 AND status='active' AND lower(active_snapshot->>'upiId')=lower($2) AND id<>$3",
          [body.organiser, details.upiId, id],
        )
      ).rows[0];
      if (duplicate) {
        if (
          !body.id &&
          JSON.stringify(duplicate.active_snapshot) === JSON.stringify(details)
        )
          return { saved: true, id: duplicate.id, version: duplicate.version };
        if (
          !body.id &&
          duplicate.active_snapshot.payee === details.payee &&
          duplicate.active_snapshot.upiId.toLowerCase() ===
            details.upiId.toLowerCase()
        )
          return { saved: true, id: duplicate.id, version: duplicate.version };
        throw new OperationError(
          "This UPI ID is already linked to this organiser. Edit the existing record.",
          409,
        );
      }
      if (body.id) {
        const result = await client.query(
          "UPDATE tpa.payment_details SET organiser=$2,draft=$3,active_snapshot=$3,status='active',version=version+1,updated_at=now() WHERE id::text=$1 AND version=$4 AND organiser IS NOT NULL RETURNING *",
          [id, body.organiser, details, body.version],
        );
        if (!result.rowCount)
          throw new OperationError(
            "This UPI record changed. Reload before saving.",
            409,
          );
      } else
        await client.query(
          "INSERT INTO tpa.payment_details(id,organiser,draft,active_snapshot,status) VALUES($1,$2,$3,$3,'active')",
          [id, body.organiser, details],
        );
      const version = body.id ? body.version + 1 : 1;
      await client.query(
        "INSERT INTO tpa.payment_detail_revisions(detail_id,version,status,details,actor_user_id) VALUES($1,$2,'active',$3,$4)",
        [id, version, details, actor.id],
      );
      await audit(client, actor.id, "organiser_upi.saved", id);
      return { saved: true, id, version };
    });
  });
}
