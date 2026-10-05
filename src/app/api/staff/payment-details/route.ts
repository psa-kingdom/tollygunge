import { randomUUID } from "node:crypto";
import { record, uuid, version } from "@/domain/operations";
import { paymentDetails } from "@/domain/payment-details";
import { getDatabase } from "@/lib/database";
import {
  authorized,
  operation,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "payments:manage");
    return {
      records: (
        await getDatabase().query(
          "SELECT * FROM tpa.payment_details ORDER BY updated_at DESC LIMIT 100",
        )
      ).rows,
      revisions: (
        await getDatabase().query(
          "SELECT r.detail_id,r.version,r.status,r.details,r.created_at FROM tpa.payment_detail_revisions r ORDER BY r.id DESC LIMIT 300",
        )
      ).rows,
    };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "payments:manage", true),
      body = record(await jsonBody(request)),
      expected = version(body.version),
      action = String(body.action);
    if (!["save", "active", "draft", "past"].includes(action))
      throw new OperationError("Choose a supported action.");
    const id = body.id ? uuid(body.id) : randomUUID(),
      details = action === "save" ? paymentDetails(body.details) : undefined;
    if (!body.id && (action !== "save" || expected !== 0))
      throw new OperationError("Create a draft first.");
    return transaction(async (client) => {
      const existing = (
        await client.query(
          "SELECT * FROM tpa.payment_details WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (body.id && !existing)
        throw new OperationError("Record not found.", 404);
      if (existing && existing.version !== expected)
        throw new OperationError(
          "This record changed. Reload before saving.",
          409,
        );
      if (action === "active" && body.confirmPayee !== true)
        throw new OperationError(
          "Confirm that the payee, UPI ID and QR belong to TPA before activation.",
        );
      const draft = details ?? existing?.draft;
      if (
        draft?.qrId &&
        !(
          await client.query(
            "SELECT 1 FROM tpa.payment_qr_images WHERE id=$1",
            [draft.qrId],
          )
        ).rowCount
      )
        throw new OperationError("Choose an uploaded payment QR image.");
      const status = action === "save" ? (existing?.status ?? "draft") : action;
      const active =
        action === "active" ? draft : (existing?.active_snapshot ?? null);
      if (existing)
        await client.query(
          "UPDATE tpa.payment_details SET draft=$2,status=$3,active_snapshot=$4,version=version+1,updated_at=now() WHERE id=$1",
          [id, draft, status, active],
        );
      else
        await client.query(
          "INSERT INTO tpa.payment_details(id,draft) VALUES($1,$2)",
          [id, draft],
        );
      await client.query(
        "INSERT INTO tpa.payment_detail_revisions(detail_id,version,status,details,actor_user_id) VALUES($1,$2,$3,$4,$5)",
        [id, expected + 1, status, draft, actor.id],
      );
      await audit(client, actor.id, `payment_details.${action}`, id);
      return { id, version: expected + 1, status };
    });
  });
}
