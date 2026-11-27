import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { authorized, OperationError, transaction } from "./operation-api";
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
export async function paymentProofForm(request: Request) {
  try {
    const bytes = await boundedBody(request, MAX_DOCUMENT_BYTES + 65536);
    const form = await new Response(bytes as BodyInit, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    return { input: record(JSON.parse(String(form.get("details")))), file: form.get("file") };
  } catch {
    throw new OperationError("Check the submitted details and attach a file up to 5 MB.");
  }
}

export async function paymentProofTransaction<T>(
  file: FormDataEntryValue | null,
  required: boolean,
  save: (client: PoolClient, attach: (entryId: string, ownerId: string) => Promise<void>) => Promise<T>,
) {
  const upload = file instanceof File && file.size > 0 ? file : null;
  if (!upload) {
    if (required) throw new OperationError("Attach your payment proof.");
    return transaction(client => save(client, async () => {}));
  }
  try {
    validateDocument("supporting", upload.type, upload.size);
  } catch (error) {
    throw new OperationError((error as Error).message);
  }
  const proofBytes = new Uint8Array(await upload.arrayBuffer());
  if (!matchesFileSignature(proofBytes, upload.type))
    throw new OperationError("File content does not match its type.");
  if (!privateStorageConfigured())
    throw new OperationError("Private proof storage is unavailable. Please try again later.", 503);

  const proofId = randomUUID();
  let storedBy: string | undefined;
  try {
    return await transaction(client => save(client, async (entryId, ownerId) => {
      try {
        await storePrivateDocument(proofId, proofBytes, upload.type);
      } catch {
        throw new OperationError("Payment proof could not be stored. Please try again.", 503);
      }
      storedBy = ownerId;
      await client.query(
        "INSERT INTO tpa.finance_proofs(id,entry_id,owner_id,content_type,byte_size) VALUES($1,$2,$3,$4,$5)",
        [proofId, entryId, ownerId, upload.type, upload.size],
      );
    }));
  } catch (error) {
    if (storedBy)
      try {
        await removeFailedUpload(proofId);
      } catch {
        await getDatabase().query(
          "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'finance.proof_cleanup_required',$2)",
          [storedBy, proofId],
        );
      }
    throw error;
  }
}

export async function receiptUpload(request: Request, member: boolean) {
  const actor = await authorized(request, member ? undefined : "payments:manage", true);
  const { input, file } = await paymentProofForm(request);
  return paymentProofTransaction(file, member, async (client, attach) => {
    const result = await createReceipt(client, actor, input, member);
    await attach(result.id, actor.id);
    return result;
  });
}
