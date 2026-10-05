import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { Pool } from "pg";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { databaseOptions } from "../src/lib/database-options";
import { parseR2Credentials } from "../src/domain/r2-credentials";
import { mediaObjectKey } from "../src/domain/media";
const base = process.env.TPA_TEST_URL;
test(
  "editorial media requires publication and never exposes private document IDs",
  {
    skip: !base || !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET,
  },
  async () => {
    const pool = new Pool(databaseOptions()),
      person = randomUUID(),
      asset = randomUUID(),
      token = randomBytes(32).toString("hex");
    let objectId: string | undefined, storage: S3Client | undefined;
    const cookie =
      "better-auth.session_token=" +
      encodeURIComponent(
        token +
          "." +
          createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
            .update(token)
            .digest("base64"),
      );
    const request = (
      path: string,
      init: RequestInit = {},
      authenticated = true,
    ) =>
      fetch(base + path, {
        ...init,
        redirect: "manual",
        headers: {
          ...(authenticated ? { cookie } : {}),
          origin: base!,
          ...init.headers,
        },
      });
    const action = (
      id: string,
      version: number,
      action: string,
      details?: object,
    ) =>
      request("/api/staff/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, version, action, details }),
      });
    try {
      await pool.query(
        'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Editorial fixture\',$2,true)',
        [person, person + "@example.invalid"],
      );
      await pool.query(
        'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
        [randomUUID(), token, person],
      );
      await pool.query(
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'content_editor')",
        [person],
      );
      assert.equal((await request("/api/staff/media", {}, false)).status, 401);
      const details = {
        title: "Synthetic editorial image",
        altText: "A plain blue synthetic test rectangle",
        category: "Synthetic",
      };
      await pool.query(
        "INSERT INTO tpa.public_media(id,title,alt_text,category,draft,content_type,byte_size,width,height,uploaded_by) VALUES($1,$2,$3,$4,$5,'image/webp',24,40,20,$6)",
        [
          asset,
          details.title,
          details.altText,
          details.category,
          details,
          person,
        ],
      );
      assert.equal((await request(`/media/${asset}`, {}, false)).status, 404);
      assert.equal((await action(asset, 1, "publish")).status, 200);
      const edited = { ...details, title: "UNPUBLISHED MEDIA DESCRIPTION" };
      assert.equal((await action(asset, 2, "save", edited)).status, 200);
      assert.equal((await action(asset, 2, "publish")).status, 409);
      const page = await (await request("/resources", {}, false)).text();
      assert.ok(page.includes(details.title));
      assert.ok(!page.includes(edited.title));
      assert.equal((await action(asset, 3, "unpublish")).status, 200);
      assert.equal((await request(`/media/${asset}`, {}, false)).status, 404);
      await pool.query(
        "INSERT INTO tpa.private_documents(id,owner_user_id,kind,content_type,byte_size) VALUES($1,$2,'photograph','image/png',20)",
        [randomUUID(), person],
      );
      const privateId = (
        await pool.query(
          "SELECT id FROM tpa.private_documents WHERE owner_user_id=$1",
          [person],
        )
      ).rows[0].id;
      assert.equal(
        (await request(`/media/${privateId}`, {}, false)).status,
        404,
      );
      const upload = async (bytes: Uint8Array, type: string) => {
        const form = new FormData();
        for (const [key, value] of Object.entries(details))
          form.set(key, value);
        form.set(
          "file",
          new Blob([bytes as BlobPart], { type }),
          "synthetic.png",
        );
        return request("/api/staff/media", { method: "POST", body: form });
      };
      assert.equal(
        (
          await upload(
            new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
            "image/png",
          )
        ).status,
        400,
      );
      const source = await sharp({
        create: { width: 40, height: 20, channels: 3, background: "blue" },
      })
        .withMetadata()
        .png()
        .toBuffer();
      const storageEnabled = process.env.TPA_TEST_STORAGE === "true";
      if (storageEnabled) {
        const credentials = parseR2Credentials(
          readFileSync(process.env.CLOUDFLARE_CREDENTIAL_FILE!, "utf8"),
        );
        storage = new S3Client({
          region: "auto",
          endpoint: `https://${credentials.accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
          },
        });
        const response = await upload(source, "image/png");
        assert.equal(response.status, 200);
        objectId = (await response.json()).id;
        assert.equal(
          (await request(`/media/${objectId}`, {}, false)).status,
          404,
        );
        const preview = await request(`/media/${objectId}`);
        assert.equal(preview.status, 200);
        const metadata = await sharp(
          new Uint8Array(await preview.arrayBuffer()),
        ).metadata();
        assert.equal(metadata.format, "webp");
        assert.equal(metadata.exif, undefined);
        assert.equal((await action(objectId!, 1, "publish")).status, 200);
        const publicImage = await request(`/media/${objectId}`, {}, false);
        assert.equal(publicImage.status, 200);
        assert.equal(
          publicImage.headers.get("cache-control"),
          "private, no-store",
        );
        assert.equal((await action(objectId!, 2, "unpublish")).status, 200);
        assert.equal(
          (await request(`/media/${objectId}`, {}, false)).status,
          404,
        );
      } else if (process.env.TPA_TEST_EXPECT_STORAGE_DISABLED === "true")
        assert.equal((await upload(source, "image/png")).status, 503);
      await pool.query("DELETE FROM tpa.staff_roles WHERE user_id=$1", [
        person,
      ]);
      assert.equal((await request("/api/staff/media")).status, 403);
      assert.equal((await request(`/media/${asset}`)).status, 404);
    } finally {
      if (storage && objectId)
        await storage.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: mediaObjectKey(objectId),
          }),
        );
      await pool.query("DELETE FROM tpa.public_media WHERE uploaded_by=$1", [
        person,
      ]);
      await pool.query(
        "DELETE FROM tpa.private_documents WHERE owner_user_id=$1",
        [person],
      );
      await pool.query("DELETE FROM tpa.audit_events WHERE actor_user_id=$1", [
        person,
      ]);
      await pool.query('DELETE FROM public."user" WHERE id=$1', [person]);
      await pool.end();
    }
  },
);
