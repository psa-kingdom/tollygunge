import { randomUUID } from "node:crypto";
import { mediaDetails, normalizeMedia } from "@/domain/media";
import { record, uuid, version } from "@/domain/operations";
import { boundedBody } from "@/domain/request-body";
import { MAX_DOCUMENT_BYTES } from "@/domain/documents";
import { uploadWithCleanup, UploadFailure } from "@/domain/upload-workflow";
import { getDatabase } from "@/lib/database";
import {
  privateStorageConfigured,
  storeEditorialMedia,
  removeEditorialMedia,
} from "@/lib/private-storage";
import {
  authorized,
  audit,
  jsonBody,
  operation,
  OperationError,
  transaction,
} from "@/lib/operation-api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "content:publish");
    const value = new URL(request.url).searchParams.get("id");
    const id = value ? uuid(value) : null;
    return {
      assets: (
        await getDatabase().query(
          "SELECT id,draft,published,width,height,byte_size,version,created_at FROM tpa.public_media WHERE ($1::uuid IS NULL OR id=$1) ORDER BY created_at DESC LIMIT 100",
          [id],
        )
      ).rows,
      uploadEnabled: privateStorageConfigured(),
    };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "content:publish", true);
    if (request.headers.get("content-type")?.startsWith("application/json")) {
      const body = record(await jsonBody(request)),
        id = uuid(body.id),
        expected = version(body.version);
      if (!["save", "publish", "unpublish"].includes(String(body.action)))
        throw new OperationError("Choose a supported action.");
      const details =
        body.action === "save" ? mediaDetails(body.details) : undefined;
      return transaction(async (client) => {
        const result = await client.query(
          "SELECT version,draft FROM tpa.public_media WHERE id=$1 FOR UPDATE",
          [id],
        );
        if (!result.rowCount) throw new OperationError("Asset not found.", 404);
        if (result.rows[0].version !== expected)
          throw new OperationError(
            "This asset changed. Reload before saving.",
            409,
          );
        if (details)
          await client.query(
            "UPDATE tpa.public_media SET draft=$2,title=$3,alt_text=$4,category=$5,version=version+1 WHERE id=$1",
            [id, details, details.title, details.altText, details.category],
          );
        else
          await client.query(
            `UPDATE tpa.public_media SET published=${body.action === "publish" ? "draft" : "NULL"},version=version+1 WHERE id=$1`,
            [id],
          );
        await audit(client, actor.id, `media.${body.action}`, id);
        return { id, version: expected + 1 };
      });
    }
    let details, normalized;
    try {
      const bytes = await boundedBody(request, MAX_DOCUMENT_BYTES + 65536);
      const form = await new Response(bytes as BodyInit, {
        headers: { "Content-Type": request.headers.get("content-type") ?? "" },
      }).formData();
      details = mediaDetails({
        title: form.get("title"),
        altText: form.get("altText"),
        category: form.get("category"),
        homepageFeatured: form.get("homepageFeatured") === "true",
      });
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error();
      normalized = await normalizeMedia(
        new Uint8Array(await file.arrayBuffer()),
        file.type,
      );
    } catch {
      throw new OperationError(
        "Provide title, category and an image description, with a valid static JPEG or PNG up to 5 MB.",
      );
    }
    if (!privateStorageConfigured())
      throw new OperationError(
        "Editorial storage awaits production secret configuration.",
        503,
      );
    const id = randomUUID();
    try {
      await uploadWithCleanup({
        store: () => storeEditorialMedia(id, normalized.bytes),
        persist: () =>
          transaction(async (client) => {
            await client.query(
              "INSERT INTO tpa.public_media(id,title,alt_text,category,draft,content_type,byte_size,width,height,uploaded_by) VALUES($1,$2,$3,$4,$5,'image/webp',$6,$7,$8,$9)",
              [
                id,
                details.title,
                details.altText,
                details.category,
                details,
                normalized.bytes.length,
                normalized.width,
                normalized.height,
                actor.id,
              ],
            );
            await audit(client, actor.id, "media.uploaded", id);
          }),
        remove: () => removeEditorialMedia(id),
      });
    } catch (error) {
      if (error instanceof UploadFailure && error.cleanupFailed) {
        await getDatabase()
          .query(
            "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'media.cleanup_required',$2)",
            [actor.id, id],
          )
          .catch(() =>
            console.error("Editorial media cleanup audit unavailable.", {
              assetId: id,
            }),
          );
      }
      throw new OperationError(
        "Upload did not complete. Try again later.",
        503,
      );
    }
    return { id };
  });
}
