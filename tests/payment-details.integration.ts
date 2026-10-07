import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import qrcode from "qrcode";
import sharp from "sharp";
import jsQR from "jsqr";
import { readFileSync } from "node:fs";
import { parseR2Credentials } from "../src/domain/r2-credentials";
import { paymentQrKey } from "../src/domain/payment-details";
import {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
const base = process.env.TPA_TEST_URL;
test(
  "role-aware navigation and versioned payment instructions preserve activation and QR privacy",
  {
    skip: !base || !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET,
  },
  async () => {
    const pool = new Pool(databaseOptions()),
      people = [randomUUID(), randomUUID()],
      cookies: string[] = [],
      ids: string[] = [];
    let qrId: string | undefined, storage: S3Client | undefined;
    try {
      for (const id of people) {
        await pool.query(
          'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Payment fixture\',$2,true)',
          [id, id + "@example.invalid"],
        );
        const token = randomBytes(32).toString("hex");
        await pool.query(
          'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
          [randomUUID(), token, id],
        );
        cookies.push(
          "better-auth.session_token=" +
            encodeURIComponent(
              token +
                "." +
                createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
                  .update(token)
                  .digest("base64"),
            ),
        );
      }
      await pool.query(
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'finance_operator')",
        [people[0]],
      );
      const request = (path: string, person?: number, body?: object) =>
        fetch(base + path, {
          redirect: "manual",
          method: body ? "POST" : "GET",
          headers: {
            ...(person !== undefined ? { cookie: cookies[person] } : {}),
            ...(body
              ? { "content-type": "application/json", origin: base! }
              : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      assert.equal(
        (await request("/account", 0)).headers.get("location"),
        "/admin",
      );
      assert.equal(
        (await request("/member", 0)).headers.get("location"),
        "/admin",
      );
      assert.equal(
        (await request("/login", 0)).headers.get("location"),
        "/admin",
      );
      assert.equal(
        (await request("/account", 1)).headers.get("location"),
        "/member",
      );
      const profile = await (await request("/account/profile", 0)).text();
      assert.ok(profile.includes('aria-label="Account navigation"'));
      assert.ok(!profile.includes("Member login ↗"));
      assert.ok(!profile.includes("Join TPA"));
      const member = await (await request("/member", 1)).text();
      assert.ok(member.includes('aria-label="Account navigation"'));
      assert.ok(!member.includes("Staff workspace"));
      assert.ok(!member.includes("Member login ↗"));
      assert.equal((await request("/api/staff/payment-details")).status, 401);
      assert.equal(
        (await request("/api/staff/payment-details", 1)).status,
        403,
      );
      assert.equal((await request("/api/member/payment-details")).status, 401);
      const details = {
        label: "Synthetic collection",
        payee: "Synthetic TPA test",
        upiId: "synthetic@invalid",
        phone: "+91 1234567890",
        qrId: null,
      };
      const saved = await request("/api/staff/payment-details", 0, {
        action: "save",
        version: 0,
        details,
      });
      assert.equal(saved.status, 200);
      const record = await saved.json();
      ids.push(record.id);
      assert.ok(
        !(
          await (await request("/api/member/payment-details", 1)).json()
        ).records.some((r: { id: string }) => r.id === record.id),
      );
      assert.equal(
        (
          await request("/api/staff/payment-details", 0, {
            id: record.id,
            action: "active",
            version: 1,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("/api/staff/payment-details", 0, {
            id: record.id,
            action: "active",
            version: 1,
            confirmPayee: true,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request("/api/staff/payment-details", 0, {
            id: record.id,
            action: "save",
            version: 2,
            details: { ...details, upiId: "synthetic-new@invalid" },
          })
        ).status,
        200,
      );
      const active = await (
        await request("/api/member/payment-details", 1)
      ).json();
      assert.equal(active.collectionEnabled, false);
      assert.equal(
        active.records.find((r: { id: string }) => r.id === record.id).details
          .upiId,
        details.upiId,
      );
      assert.equal(
        (
          await request("/api/staff/payment-details", 0, {
            id: record.id,
            action: "active",
            version: 2,
            confirmPayee: true,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request("/api/staff/payment-details", 0, {
            id: record.id,
            action: "past",
            version: 3,
          })
        ).status,
        200,
      );
      assert.ok(
        !(
          await (await request("/api/member/payment-details", 1)).json()
        ).records.some((r: { id: string }) => r.id === record.id),
      );
      assert.equal(
        (
          await request("/api/staff/payment-details", 0, {
            id: record.id,
            action: "save",
            version: 4,
            details: { ...details, qrId: randomUUID() },
          })
        ).status,
        400,
      );
      const uri = "upi://pay?pa=synthetic%40invalid&pn=Synthetic%20test",
        bytes = await qrcode.toBuffer(uri, { width: 512, margin: 4 });
      const upload = async (bytes: Uint8Array) => {
        const form = new FormData();
        form.set(
          "file",
          new Blob([bytes as BlobPart], { type: "image/png" }),
          "synthetic-qr.png",
        );
        return fetch(base + "/api/staff/payment-qr", {
          method: "POST",
          headers: { cookie: cookies[0], origin: base! },
          body: form,
        });
      };
      assert.equal(
        (await upload(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])))
          .status,
        400,
      );
      if (process.env.TPA_TEST_STORAGE === "true") {
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
        const result = await upload(bytes);
        assert.equal(result.status, 200);
        qrId = (await result.json()).id;
        assert.equal((await request(`/api/payment-qr/${qrId}`)).status, 401);
        assert.equal((await request(`/api/payment-qr/${qrId}`, 1)).status, 404);
        const qr = await request(`/api/payment-qr/${qrId}`, 0);
        assert.equal(qr.status, 200);
        const raw = await sharp(new Uint8Array(await qr.arrayBuffer()))
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        assert.equal(
          jsQR(new Uint8ClampedArray(raw.data), raw.info.width, raw.info.height)
            ?.data,
          uri,
        );
        assert.equal(
          (
            await request("/api/staff/payment-details", 0, {
              id: record.id,
              action: "save",
              version: 4,
              details: { ...details, qrId },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request("/api/staff/payment-details", 0, {
              id: record.id,
              action: "active",
              version: 5,
              confirmPayee: true,
            })
          ).status,
          200,
        );
        assert.equal((await request(`/api/payment-qr/${qrId}`, 1)).status, 200);
        assert.equal(
          (
            await request("/api/staff/payment-details", 0, {
              id: record.id,
              action: "draft",
              version: 6,
            })
          ).status,
          200,
        );
        assert.equal((await request(`/api/payment-qr/${qrId}`, 1)).status, 404);
      } else if (process.env.TPA_TEST_EXPECT_STORAGE_DISABLED === "true")
        assert.equal((await upload(bytes)).status, 503);
      assert.ok(
        (
          await (await request("/api/staff/payment-details", 0)).json()
        ).revisions.filter(
          (r: { detail_id: string }) => r.detail_id === record.id,
        ).length >= 4,
      );
    } finally {
      for (const id of ids) {
        await pool.query(
          "DELETE FROM tpa.payment_detail_revisions WHERE detail_id=$1",
          [id],
        );
        await pool.query("DELETE FROM tpa.payment_details WHERE id=$1", [id]);
      }
      if (storage && qrId) {
        await storage.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: paymentQrKey(qrId),
          }),
        );
        await assert.rejects(
          storage.send(
            new HeadObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME!,
              Key: paymentQrKey(qrId),
            }),
          ),
          (error: unknown) =>
            (error as { $metadata: { httpStatusCode: number } }).$metadata
              .httpStatusCode === 404,
        );
        storage.destroy();
      }
      if (qrId)
        await pool.query("DELETE FROM tpa.payment_qr_images WHERE id=$1", [
          qrId,
        ]);
      for (const id of people) {
        await pool.query(
          "DELETE FROM tpa.audit_events WHERE actor_user_id=$1",
          [id],
        );
        await pool.query('DELETE FROM public."user" WHERE id=$1', [id]);
      }
      await pool.end();
    }
  },
);
