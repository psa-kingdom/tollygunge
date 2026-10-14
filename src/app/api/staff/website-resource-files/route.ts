import { randomUUID } from "node:crypto";
import { boundedBody } from "@/domain/request-body";
import { matchesFileSignature, MAX_DOCUMENT_BYTES } from "@/domain/documents";
import { uuid, version } from "@/domain/operations";
import { getDatabase } from "@/lib/database";
import {
  websiteFileStorage,
  privateStorageConfigured,
} from "@/lib/private-storage";
import {
  operation,
  authorized,
  audit,
  OperationError,
} from "@/lib/operation-api";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "content:publish", true);
    const bytes = await boundedBody(request, MAX_DOCUMENT_BYTES + 65536);
    const form = await new Response(bytes as BodyInit, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
    const resourceId = uuid(form.get("resourceId")),
      expected = version(Number(form.get("version"))),
      file = form.get("file");
    if (
      !(file instanceof File) ||
      file.type !== "application/pdf" ||
      file.size < 1 ||
      file.size > MAX_DOCUMENT_BYTES
    )
      throw new OperationError("Upload a PDF up to 5 MB.");
    const payload = new Uint8Array(await file.arrayBuffer());
    if (!matchesFileSignature(payload, "application/pdf"))
      throw new OperationError("Upload a valid PDF.");
    if (!privateStorageConfigured())
      throw new OperationError("Document storage is not configured.", 503);
    const id = randomUUID(),
      c = await getDatabase().connect();
    let stored = false,
      committed = false;
    try {
      await c.query("BEGIN");
      const row = (
        await c.query(
          "SELECT * FROM tpa.website_resources WHERE id=$1 AND kind='document' FOR UPDATE",
          [resourceId],
        )
      ).rows[0];
      if (!row || row.archived_at || row.version !== expected)
        throw new OperationError(
          "Download changed. Reload before uploading.",
          409,
        );
      stored = true;
      await websiteFileStorage(id, "store", payload);
      await c.query(
        "INSERT INTO tpa.website_resource_files(id,resource_id,original_name,byte_size,uploaded_by) VALUES($1,$2,$3,$4,$5)",
        [id, resourceId, file.name.slice(0, 200), file.size, actor.id],
      );
      const result = (
        await c.query(
          "UPDATE tpa.website_resources SET draft=jsonb_set(jsonb_set(draft,'{fileId}',to_jsonb($2::text)),'{url}','\"\"'),version=version+1,updated_by=$3,updated_at=now() WHERE id=$1 RETURNING *",
          [resourceId, id, actor.id],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO tpa.website_revisions(entity,version,action,body,actor_id) VALUES($1,$2,'upload',$3,$4)",
        [resourceId, result.version, result.draft, actor.id],
      );
      await audit(c, actor.id, "website.document.upload", resourceId);
      await c.query("COMMIT");
      committed = true;
      return result;
    } catch (error) {
      await c.query("ROLLBACK");
      if (stored && !committed) {
        try {
          await websiteFileStorage(id, "remove");
        } catch {
          await getDatabase().query(
            "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'website.document.cleanup_required',$2)",
            [actor.id, id],
          );
        }
      }
      throw error;
    } finally {
      c.release();
    }
  });
}
