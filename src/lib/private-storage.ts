import "server-only";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { privateObjectKey } from "@/domain/documents";
function storage() {
  const {
    R2_ACCOUNT_ID,
    R2_BUCKET_NAME,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
  } = process.env;
  if (
    !R2_ACCOUNT_ID ||
    !R2_BUCKET_NAME ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY
  )
    throw new Error("TPA private document storage is not configured.");
  if (!/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID))
    throw new Error("Invalid R2 account configuration.");
  return {
    bucket: R2_BUCKET_NAME,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    }),
  };
}
// Call only after authenticated authorization and server-side size/signature validation.
export async function storePrivateDocument(
  id: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const { bucket, client } = storage();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: privateObjectKey(id),
      Body: bytes,
      ContentType: contentType,
      CacheControl: "private, no-store",
    }),
  );
}
// This internal helper is not a public endpoint. The requesting user must be authorized first.
export async function privateDocumentDownload(id: string) {
  const { bucket, client } = storage();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: privateObjectKey(id),
      ResponseContentDisposition: "attachment",
      ResponseCacheControl: "private, no-store",
    }),
    { expiresIn: 60 },
  );
}
export async function removeFailedUpload(id: string) {
  const { bucket, client } = storage();
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: privateObjectKey(id) }),
  );
}
