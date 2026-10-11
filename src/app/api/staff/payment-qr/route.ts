import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { boundedBody } from "@/domain/request-body";
import { matchesFileSignature, MAX_DOCUMENT_BYTES } from "@/domain/documents";
import { uploadWithCleanup, UploadFailure } from "@/domain/upload-workflow";
import {
  privateStorageConfigured,
  paymentQrStorage,
} from "@/lib/private-storage";
import {
  authorized,
  operation,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "payments:manage", true);
    let output;
    try {
      const body = await boundedBody(request, MAX_DOCUMENT_BYTES + 65536),
        form = await new Response(body as BodyInit, {
          headers: {
            "Content-Type": request.headers.get("content-type") ?? "",
          },
        }).formData(),
        file = form.get("file");
      if (
        !(file instanceof File) ||
        file.size > MAX_DOCUMENT_BYTES ||
        !["image/png", "image/jpeg"].includes(file.type)
      )
        throw new Error();
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!matchesFileSignature(bytes, file.type)) throw new Error();
      const image = sharp(bytes, {
        limitInputPixels: 20000000,
        failOn: "warning",
      });
      const metadata = await image.metadata();
      if ((metadata.pages ?? 1) > 1) throw new Error();
      output = await image
        .rotate()
        .resize({
          width: 2400,
          height: 2400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer({ resolveWithObject: true });
      if (output.data.length > MAX_DOCUMENT_BYTES) throw new Error();
    } catch {
      throw new OperationError(
        "Choose a valid static JPEG or PNG QR photo up to 5 MB.",
      );
    }
    if (!privateStorageConfigured())
      throw new OperationError(
        "QR uploads await managed production storage.",
        503,
      );
    const id = randomUUID();
    try {
      await uploadWithCleanup({
        store: async () => {
          await paymentQrStorage(id, "store", output.data);
        },
        persist: () =>
          transaction(async (client) => {
            await client.query(
              "INSERT INTO tpa.payment_qr_images(id,uploaded_by,width,height) VALUES($1,$2,$3,$4)",
              [id, actor.id, output.info.width, output.info.height],
            );
            await audit(client, actor.id, "payment_qr.uploaded", id);
          }),
        remove: async () => {
          await paymentQrStorage(id, "remove");
        },
      });
    } catch (error) {
      if (error instanceof UploadFailure && error.cleanupFailed)
        await getDatabase()
          .query(
            "INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'payment_qr.cleanup_required',$2)",
            [actor.id, id],
          )
          .catch(() => {});
      throw new OperationError("Upload failed. Try again later.", 503);
    }
    return { id, width: output.info.width, height: output.info.height };
  });
}
