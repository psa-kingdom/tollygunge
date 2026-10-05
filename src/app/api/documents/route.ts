import { randomUUID } from "node:crypto";
import { currentActor } from "@/lib/actor";
import { getDatabase } from "@/lib/database";
import { isSameOrigin } from "@/lib/request-policy";
import {
  storePrivateDocument,
  removeFailedUpload,
  privateStorageConfigured,
} from "@/lib/private-storage";
import {
  MAX_DOCUMENT_BYTES,
  matchesFileSignature,
  validateDocument,
} from "@/domain/documents";
import { boundedBody } from "@/domain/request-body";
import { uploadWithCleanup, UploadFailure } from "@/domain/upload-workflow";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const actor = await currentActor(request.headers);
  if (!actor)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const { rows } = await getDatabase().query(
    "SELECT id,kind,content_type,byte_size,created_at FROM tpa.private_documents WHERE owner_user_id=$1 ORDER BY created_at DESC",
    [actor.id],
  );
  return Response.json(rows, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(request: Request) {
  const actor = await currentActor(request.headers);
  if (!actor)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!isSameOrigin(request))
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  let bytes: Uint8Array, kind: string, contentType: string;
  try {
    const body = await boundedBody(request, MAX_DOCUMENT_BYTES + 64 * 1024);
    const form = await new Response(body as BodyInit, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("file");
    kind = String(form.get("kind") ?? "");
    if (!(file instanceof File)) throw new Error();
    contentType = file.type;
    validateDocument(kind, contentType, file.size);
    bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesFileSignature(bytes, contentType)) throw new Error();
  } catch {
    return Response.json(
      {
        error:
          "Choose a valid PDF, JPEG or PNG up to 5 MB. Photographs must be JPEG or PNG.",
      },
      { status: 400 },
    );
  }
  const id = randomUUID();
  if (!privateStorageConfigured())
    return Response.json(
      { error: "Private uploads are being configured." },
      { status: 503 },
    );
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    // Write metadata transaction first, then storage. Failed storage/commit removes only this request's object.
    await client.query(
      "INSERT INTO tpa.private_documents(id,owner_user_id,kind,content_type,byte_size) VALUES($1,$2,$3,$4,$5)",
      [id, actor.id, kind, contentType, bytes.byteLength],
    );
    await uploadWithCleanup({
      store: () => storePrivateDocument(id, bytes, contentType),
      persist: async () => {
        await client.query(
          "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'document.uploaded',$2)",
          [actor.id, id],
        );
        await client.query("COMMIT");
      },
      remove: () => removeFailedUpload(id),
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof UploadFailure && error.cleanupFailed) {
      console.error("Private upload cleanup needs reconciliation.", {
        documentId: id,
      });
      await getDatabase()
        .query(
          "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'document.cleanup_required',$2)",
          [actor.id, id],
        )
        .catch(() => {
          console.error("Cleanup audit could not be recorded.", {
            documentId: id,
          });
        });
    }
    return Response.json(
      { error: "Upload did not complete. Please try again later." },
      { status: 503 },
    );
  } finally {
    client.release();
  }
}
