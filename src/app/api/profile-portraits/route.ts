import { randomUUID } from "node:crypto";
import {
  authorized,
  operation,
  OperationError,
  audit,
  transaction,
} from "@/lib/operation-api";
import { staffPeople } from "@/lib/people-service";
import { getDatabase } from "@/lib/database";
import { boundedBody } from "@/domain/request-body";
import { uuid, text } from "@/domain/operations";
import { normalizeMedia } from "@/domain/media";
import { uploadWithCleanup, UploadFailure } from "@/domain/upload-workflow";
import {
  privateStorageConfigured,
  portraitStorage,
} from "@/lib/private-storage";
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request),
      id = uuid(new URL(request.url).searchParams.get("personId"));
    const owner = (
      await getDatabase().query("SELECT user_id FROM tpa.people WHERE id=$1", [
        id,
      ])
    ).rows[0];
    if (!owner || (owner.user_id !== actor.id && !staffPeople(actor)))
      throw new OperationError("Access denied.", 403);
    return {
      uploadEnabled: privateStorageConfigured(),
      portraits: (
        await getDatabase().query(
          "SELECT id,alt_text,width,height,created_at FROM tpa.profile_portraits WHERE person_id=$1 ORDER BY created_at DESC",
          [id],
        )
      ).rows,
    };
  });
}
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, undefined, true);
    const bytes = await boundedBody(request, 5 * 1024 * 1024 + 65536);
    const form = await new Response(bytes as BodyInit, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
    const personId = uuid(form.get("personId"));
    const owner = (
      await getDatabase().query("SELECT user_id FROM tpa.people WHERE id=$1", [
        personId,
      ])
    ).rows[0];
    if (!owner || (owner.user_id !== actor.id && !staffPeople(actor)))
      throw new OperationError("Access denied.", 403);
    const file = form.get("file");
    if (!(file instanceof File))
      throw new OperationError("Choose a JPEG or PNG portrait.");
    const image = await normalizeMedia(
      new Uint8Array(await file.arrayBuffer()),
      file.type,
    );
    const alt = text(form.get("altText"), "Portrait description", 200, 2);
    if (!privateStorageConfigured())
      throw new OperationError(
        "Portrait uploads require managed storage configuration.",
        503,
      );
    const id = randomUUID();
    try {
      await uploadWithCleanup({
        store: async () => {
          await portraitStorage(id, "store", image.bytes);
        },
        persist: () =>
          transaction(async (client) => {
            await client.query(
              "INSERT INTO tpa.profile_portraits(id,person_id,alt_text,width,height,byte_size,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
              [
                id,
                personId,
                alt,
                image.width,
                image.height,
                image.bytes.length,
                actor.id,
              ],
            );
            await audit(client, actor.id, "portrait.uploaded", id);
          }),
        remove: async () => {
          await portraitStorage(id, "remove");
        },
      });
    } catch (error) {
      if (error instanceof UploadFailure && error.cleanupFailed)
        await getDatabase()
          .query(
            "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'portrait.cleanup_required',$2)",
            [actor.id, id],
          )
          .catch(() => {});
      throw new OperationError("Upload failed. Try again later.", 503);
    }
    return { id };
  });
}
