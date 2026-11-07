import "server-only";
import { randomUUID } from "node:crypto";
import { authorized, OperationError } from "./operation-api";
import { getDatabase } from "./database";
import { createReceipt } from "./finance";
import { boundedBody } from "@/domain/request-body";
import {
  MAX_DOCUMENT_BYTES,
  validateDocument,
  matchesFileSignature,
} from "@/domain/documents";
import { record } from "@/domain/operations";
import {
  privateStorageConfigured,
  storePrivateDocument,
  removeFailedUpload,
} from "./private-storage";
export async function receiptUpload(r: Request, member: boolean) {
  const actor = await authorized(
    r,
    member ? undefined : "payments:manage",
    true,
  );
  const bytes = await boundedBody(r, MAX_DOCUMENT_BYTES + 65536);
  const form = await new Response(bytes as BodyInit, {
    headers: { "Content-Type": r.headers.get("content-type") ?? "" },
  }).formData();
  const i = record(JSON.parse(String(form.get("details")))),
    file = form.get("file");
  const upload = file instanceof File && file.size > 0 ? file : null;
  if (member && !upload) throw new OperationError("Attach your payment proof.");
  let proofBytes: Uint8Array | undefined;
  if (upload) {
    validateDocument("supporting", upload.type, upload.size);
    proofBytes = new Uint8Array(await upload.arrayBuffer());
    if (!matchesFileSignature(proofBytes, upload.type))
      throw new OperationError("File content does not match its type.");
    if (!privateStorageConfigured())
      throw new OperationError(
        "Private proof storage is unavailable. Please try again later.",
        503,
      );
  }
  const c = await getDatabase().connect(),
    proofId = randomUUID();
  let stored = false,
    committed = false;
  try {
    await c.query("BEGIN");
    const result = await createReceipt(c, actor, i, member);
    if (upload) {
      await storePrivateDocument(proofId, proofBytes!, upload.type);
      stored = true;
      await c.query(
        "INSERT INTO tpa.finance_proofs(id,entry_id,owner_id,content_type,byte_size) VALUES($1,$2,$3,$4,$5)",
        [proofId, result.id, actor.id, upload.type, upload.size],
      );
    }
    await c.query("COMMIT");
    committed = true;
    return result;
  } catch (error) {
    await c.query("ROLLBACK");
    if (stored && !committed)
      try {
        await removeFailedUpload(proofId);
      } catch {
        await getDatabase().query(
          "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'finance.proof_cleanup_required',$2)",
          [actor.id, proofId],
        );
      }
    throw error;
  } finally {
    c.release();
  }
}
