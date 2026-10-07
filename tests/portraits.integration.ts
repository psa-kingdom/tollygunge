import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import sharp from "sharp";
import {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { databaseOptions } from "../src/lib/database-options";
import { parseR2Credentials } from "../src/domain/r2-credentials";
import { managedStorageCredentials } from "../src/domain/storage-configuration";

const base = process.env.TPA_TEST_URL;
test(
  "portraits remain private until explicit publication and become private after withdrawal",
  {
    skip: !base || !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET,
  },
  async () => {
    const pool = new Pool(databaseOptions()),
      user = randomUUID(),
      portraits: string[] = [],
      members = [randomUUID(), randomUUID()],
      memberCookies: string[] = [];
    let personId: string | undefined;
    const token = randomBytes(32).toString("hex"),
      cookie =
        (base!.startsWith("https:")
          ? "__Secure-better-auth.session_token="
          : "better-auth.session_token=") +
        encodeURIComponent(
          token +
            "." +
            createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
              .update(token)
              .digest("base64"),
        );
    const req = (path: string, body?: object) =>
      fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          cookie,
          ...(body
            ? { origin: base!, "content-type": "application/json" }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    const ok = async (path: string, body?: object) => {
      const r = await req(path, body);
      assert.equal(r.status, 200);
      return r.json();
    };
    const upload = async (
      bytes: Buffer,
      type: string,
      uploadCookie = cookie,
    ) => {
      const form = new FormData();
      form.set("personId", personId!);
      form.set("altText", "Synthetic portrait");
      form.set(
        "file",
        new Blob([new Uint8Array(bytes)], { type }),
        "synthetic.png",
      );
      return fetch(base + "/api/profile-portraits", {
        method: "POST",
        headers: { cookie: uploadCookie, origin: base! },
        body: form,
      });
    };
    try {
      await pool.query(
        'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Portrait fixture\',$2,true)',
        [user, user + "@example.invalid"],
      );
      await pool.query(
        'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
        [randomUUID(), token, user],
      );
      await pool.query(
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
        [user],
      );
      for (const member of members) {
        const memberToken = randomBytes(32).toString("hex");
        await pool.query(
          'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Portrait member fixture\',$2,true)',
          [member, member + "@example.invalid"],
        );
        await pool.query(
          'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
          [randomUUID(), memberToken, member],
        );
        memberCookies.push(
          (base!.startsWith("https:")
            ? "__Secure-better-auth.session_token="
            : "better-auth.session_token=") +
            encodeURIComponent(
              memberToken +
                "." +
                createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
                  .update(memberToken)
                  .digest("base64"),
            ),
        );
      }
      let row = await ok("/api/staff/governance", {
        action: "save",
        version: 0,
        body: {
          name: "Synthetic portrait " + user,
          assignments: [
            {
              groupId: "11111111-1111-4111-8111-111111111111",
              role: "Test portrait",
              term: "",
              order: 99,
            },
          ],
        },
      });
      personId = row.id;
      row = await ok("/api/staff/governance", {
        action: "link",
        id: personId,
        version: row.version,
        userId: members[0],
      });
      assert.equal(
        (
          await fetch(base + "/api/profile-portraits?personId=" + personId, {
            headers: { cookie: memberCookies[0] },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await fetch(base + "/api/profile-portraits?personId=" + personId, {
            headers: { cookie: memberCookies[1] },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await upload(
            Buffer.from("not an image"),
            "image/png",
            memberCookies[1],
          )
        ).status,
        403,
      );
      assert.equal(
        (await upload(Buffer.from("not an image"), "image/png")).status,
        400,
      );
      assert.equal(
        (await upload(Buffer.alloc(5 * 1024 * 1024 + 1), "image/png")).status,
        400,
      );
      const png = await sharp({
        create: { width: 160, height: 160, channels: 3, background: "#173449" },
      })
        .png()
        .toBuffer();
      const enabled = (await ok("/api/profile-portraits?personId=" + personId))
        .uploadEnabled;
      if (!enabled) {
        assert.equal((await upload(png, "image/png")).status, 503);
        return;
      }
      for (let i = 0; i < 2; i++) {
        const r = await upload(
          png,
          "image/png",
          i === 0 ? memberCookies[0] : cookie,
        );
        assert.equal(r.status, 200);
        const image = await r.json();
        portraits.push(image.id);
        assert.equal(
          (await fetch(base + "/api/profile-portraits/" + image.id)).status,
          404,
        );
        assert.equal(
          (
            await fetch(base + "/api/profile-portraits/" + image.id, {
              headers: { cookie: memberCookies[0] },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await fetch(base + "/api/profile-portraits/" + image.id, {
              headers: { cookie: memberCookies[1] },
            })
          ).status,
          404,
        );
        const own = await req("/api/profile-portraits/" + image.id);
        assert.equal(own.status, 200);
        assert.equal(own.headers.get("content-type"), "image/webp");
        row = await ok("/api/staff/governance", {
          action: "save",
          id: personId,
          version: row.version,
          body: { ...row.draft, portraitId: image.id, portraitKind: "profile" },
        });
        row = await ok("/api/staff/governance", {
          action: "submit",
          id: personId,
          version: row.version,
        });
        row = await ok("/api/staff/profile-reviews", {
          action: "approve",
          id: personId,
          version: row.version,
          reviewId: row.reviews[0].id,
        });
        assert.equal(
          (await fetch(base + "/api/profile-portraits/" + image.id)).status,
          404,
        );
        row = await ok("/api/staff/governance", {
          action: "publish",
          id: personId,
          version: row.version,
          confirmPublication: true,
        });
        assert.equal(
          (await fetch(base + "/api/profile-portraits/" + image.id)).status,
          200,
        );
        if (i === 1)
          assert.equal(
            (await fetch(base + "/api/profile-portraits/" + portraits[0]))
              .status,
            404,
          );
      }
      row = await ok("/api/staff/governance", {
        action: "unpublish",
        id: personId,
        version: row.version,
      });
      assert.equal(
        (await fetch(base + "/api/profile-portraits/" + portraits[1])).status,
        404,
      );
    } finally {
      if (portraits.length) {
        const credentials =
          managedStorageCredentials(process.env) ??
          parseR2Credentials(
            readFileSync(process.env.CLOUDFLARE_CREDENTIAL_FILE!, "utf8"),
          );
        const s3 = new S3Client({
          region: "auto",
          endpoint: `https://${credentials.accountId}.r2.cloudflarestorage.com`,
          credentials,
        });
        try {
          for (const id of portraits) {
            const key = {
              Bucket: process.env.R2_BUCKET_NAME!,
              Key: `tpa/portraits/${id}.webp`,
            };
            await s3.send(new DeleteObjectCommand(key));
            await assert.rejects(
              s3.send(new HeadObjectCommand(key)),
              (e: unknown) =>
                (e as { $metadata: { httpStatusCode: number } }).$metadata
                  .httpStatusCode === 404,
            );
          }
        } finally {
          s3.destroy();
        }
      }
      if (personId)
        await pool.query("DELETE FROM tpa.people WHERE id=$1", [personId]);
      for (const id of [user, ...members]) {
        await pool.query(
          "DELETE FROM tpa.audit_events WHERE actor_user_id=$1",
          [id],
        );
        await pool.query("DELETE FROM tpa.member_profiles WHERE user_id=$1", [
          id,
        ]);
        await pool.query('DELETE FROM public."user" WHERE id=$1', [id]);
      }
      await pool.end();
    }
  },
);
