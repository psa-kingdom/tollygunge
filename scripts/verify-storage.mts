import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { parseR2Credentials } from "../src/domain/r2-credentials";
const source = process.env.CLOUDFLARE_CREDENTIAL_FILE;
const bucket = process.env.R2_BUCKET_NAME;
if (!source || bucket !== "tpa-private-documents")
  throw new Error("Select the dedicated TPA verification bucket.");
const credentials = parseR2Credentials(readFileSync(source, "utf8"));
const endpoint = `https://${credentials.accountId}.r2.cloudflarestorage.com`;
const client = new S3Client({ region: "auto", endpoint, credentials });
const key = `tpa/private/verification/${randomUUID()}`;
const bytes = Buffer.from("TPA synthetic private-storage verification");
let uploaded = false;
try {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: "application/octet-stream",
    }),
  );
  uploaded = true;
  const signed = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 },
  );
  const response = await fetch(signed);
  if (!response.ok || !bytes.equals(Buffer.from(await response.arrayBuffer())))
    throw new Error("Download verification failed.");
  const anonymous = await fetch(`${endpoint}/${bucket}/${key}`);
  if (anonymous.ok)
    throw new Error("Anonymous object access unexpectedly succeeded.");
  console.log("Synthetic upload/download passed; anonymous access denied.");
} catch {
  process.exitCode = 1;
  console.error(
    "Storage verification failed. Credential values and signed links are withheld.",
  );
} finally {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      throw new Error("Object retained.");
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode !== 404
      )
        throw error;
    }
    console.log(
      uploaded
        ? "Synthetic object removed and absence verified."
        : "Verification object is absent.",
    );
  } catch {
    process.exitCode = 1;
    console.error("Verification cleanup could not be confirmed.");
  }
  client.destroy();
}
