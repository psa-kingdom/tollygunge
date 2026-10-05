import "server-only";
import { readFileSync } from "node:fs";
import { parseR2Credentials } from "@/domain/r2-credentials";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { privateObjectKey } from "@/domain/documents";
import { mediaObjectKey } from "@/domain/media";
export function privateStorageConfigured() {
  return (
    process.env.NODE_ENV !== "production" &&
    Boolean(
      process.env.R2_BUCKET_NAME && process.env.CLOUDFLARE_CREDENTIAL_FILE,
    )
  );
}
function storage() {
  const { R2_BUCKET_NAME, CLOUDFLARE_CREDENTIAL_FILE } = process.env;
  // Local development reads the original supplied file. Deployed uploads stay disabled
  // until a production secret mechanism is explicitly selected.
  if (
    !privateStorageConfigured() ||
    !CLOUDFLARE_CREDENTIAL_FILE ||
    !R2_BUCKET_NAME
  )
    throw new Error("TPA private document storage is not configured.");
  const credentials = parseR2Credentials(
    readFileSync(CLOUDFLARE_CREDENTIAL_FILE, "utf8"),
  );
  return {
    bucket: R2_BUCKET_NAME,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${credentials.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
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
// Editorial assets use separate keys and metadata. No private-document key is accepted here.
export async function storeEditorialMedia(id: string, bytes: Uint8Array) {
  const { bucket, client } = storage();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: mediaObjectKey(id),
      Body: bytes,
      ContentType: "image/webp",
      CacheControl: "private, no-store",
    }),
  );
}
export async function readEditorialMedia(id: string) {
  const { bucket, client } = storage();
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: mediaObjectKey(id) }),
  );
  if (!result.Body) throw new Error("Asset unavailable.");
  return result.Body.transformToByteArray();
}
export async function removeEditorialMedia(id: string) {
  const { bucket, client } = storage();
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: mediaObjectKey(id) }),
  );
}
