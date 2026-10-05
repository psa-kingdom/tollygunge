import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import { roles } from "../src/domain/access";
import { readFileSync } from "node:fs";
import { parseR2Credentials } from "../src/domain/r2-credentials";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { privateObjectKey } from "../src/domain/documents";
const base = process.env.TPA_TEST_URL;
test(
  "HTTP routes enforce account ownership, staff permissions, revocation, uploads and sign-out",
  {
    skip: !base || !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET,
  },
  async () => {
    const pool = new Pool(databaseOptions());
    const people = [randomUUID(), randomUUID(), randomUUID()];
    const cookies: string[] = [];
    const uploaded: string[] = [];
    let storage: S3Client | undefined;
    const storageEnabled = process.env.TPA_TEST_STORAGE === "true";
    try {
      for (const id of people) {
        await pool.query(
          'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
          [id, "HTTP synthetic fixture", id + "@example.invalid"],
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
      const request = (path: string, person?: number, init: RequestInit = {}) =>
        fetch(base + path, {
          redirect: "manual",
          ...init,
          headers: {
            ...(person !== undefined ? { cookie: cookies[person] } : {}),
            ...init.headers,
          },
        });
      for (const path of ["/member", "/admin", "/admin/workspaces/content"])
        assert.equal((await request(path)).headers.get("location"), "/login");
      for (const path of [
        "/api/member/profile",
        "/api/documents",
        "/api/documents/" + randomUUID(),
      ])
        assert.equal((await request(path)).status, 401);
      assert.equal((await request("/member", 0)).status, 200);
      await pool.query(
        'UPDATE public."user" SET "emailVerified"=false WHERE id=$1',
        [people[0]],
      );
      assert.equal((await request("/api/member/profile", 0)).status, 401);
      await pool.query(
        "INSERT INTO tpa.operator_approved_identities(user_id,source) VALUES($1,'user_authorized_bootstrap')",
        [people[0]],
      );
      assert.equal((await request("/api/member/profile", 0)).status, 200);
      // Removing operator approval revokes business access without needing cookie expiry.
      await pool.query(
        "DELETE FROM tpa.operator_approved_identities WHERE user_id=$1",
        [people[0]],
      );
      assert.equal((await request("/api/member/profile", 0)).status, 401);
      await pool.query(
        'UPDATE public."user" SET "emailVerified"=true WHERE id=$1',
        [people[0]],
      );
      assert.equal(
        (await request("/admin", 0)).headers.get("location"),
        "/member",
      );
      assert.equal(
        (
          await request("/api/member/profile", 0, {
            method: "POST",
            headers: {
              origin: "https://other.invalid",
              "Content-Type": "application/json",
            },
            body: "{}",
          })
        ).status,
        403,
      );
      const own = {
        phone: "+91 1234567890",
        organization: "Synthetic association",
        contactPreference: "none",
        newsletter: true,
        userId: people[1],
        role: "administrator",
      };
      assert.equal(
        (
          await request("/api/member/profile", 0, {
            method: "POST",
            headers: { origin: base!, "Content-Type": "application/json" },
            body: JSON.stringify(own),
          })
        ).status,
        200,
      );
      const p = await (
        await request("/api/member/profile?userId=" + people[1], 0)
      ).json();
      assert.equal(p.organization, own.organization);
      assert.equal(p.newsletter, true);
      assert.equal(
        (await (await request("/api/member/profile", 1)).json()).organization,
        "",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM tpa.staff_roles WHERE user_id=$1",
            [people[0]],
          )
        ).rows[0].count,
        0,
      );
      const workspaces = [
        "members",
        "content",
        "events",
        "communications",
        "payments",
      ];
      const allowed: Record<string, string[]> = {
        administrator: workspaces,
        membership_reviewer: ["members"],
        content_editor: ["content"],
        event_operator: ["events"],
        communications_operator: ["communications"],
        finance_operator: ["payments"],
      };
      for (const role of roles) {
        await pool.query("DELETE FROM tpa.staff_roles WHERE user_id=$1", [
          people[2],
        ]);
        await pool.query(
          "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,$2)",
          [people[2], role],
        );
        for (const workspace of workspaces)
          assert.equal(
            (await request("/admin/workspaces/" + workspace, 2)).status,
            allowed[role].includes(workspace) ? 200 : 404,
            role + " " + workspace,
          );
      }
      const upload = async (
        bytes: Uint8Array,
        type: string,
        kind = "certificate",
      ) => {
        const form = new FormData();
        form.set("kind", kind);
        form.set(
          "file",
          new Blob([bytes as BlobPart], { type }),
          "synthetic-file",
        );
        return request("/api/documents", 0, {
          method: "POST",
          headers: { origin: base! },
          body: form,
        });
      };
      assert.equal(
        (await upload(Buffer.from("<script>"), "application/pdf")).status,
        400,
      );
      assert.equal(
        (await upload(Buffer.from("%PDF-1.7"), "application/pdf", "photograph"))
          .status,
        400,
      );
      assert.equal(
        (await upload(Buffer.alloc(5242881), "application/pdf")).status,
        400,
      );
      if (process.env.TPA_TEST_EXPECT_STORAGE_DISABLED === "true") {
        assert.equal(
          (await upload(Buffer.from("%PDF-1.7"), "application/pdf")).status,
          503,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int AS count FROM tpa.private_documents WHERE owner_user_id=$1",
              [people[0]],
            )
          ).rows[0].count,
          0,
        );
      }
      if (storageEnabled) {
        const credentials = parseR2Credentials(
          readFileSync(process.env.CLOUDFLARE_CREDENTIAL_FILE!, "utf8"),
        );
        storage = new S3Client({
          region: "auto",
          endpoint: `https://${credentials.accountId}.r2.cloudflarestorage.com`,
          credentials,
        });
        const png = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZsAAAAASUVORK5CYII=",
          "base64",
        );
        const result = await upload(png, "image/png", "photograph");
        assert.equal(result.status, 201);
        const { id } = await result.json();
        uploaded.push(id);
        assert.equal((await request("/api/documents/" + id, 1)).status, 404);
        assert.equal(
          (await (await request("/api/documents", 1)).json()).length,
          0,
        );
        const ownDownload = await request("/api/documents/" + id, 0);
        assert.equal(ownDownload.status, 303);
        const signed = ownDownload.headers.get("location");
        assert.ok(signed);
        assert.equal(new URL(signed).searchParams.get("X-Amz-Expires"), "60");
        const response = await fetch(signed);
        assert.equal(response.status, 200);
        assert.ok(
          png.equals(Buffer.from(await response.arrayBuffer())),
          "Downloaded synthetic bytes must match.",
        );
        await pool.query("DELETE FROM tpa.staff_roles WHERE user_id=$1", [
          people[2],
        ]);
        await pool.query(
          "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'membership_reviewer')",
          [people[2]],
        );
        assert.equal((await request("/api/documents/" + id, 2)).status, 303);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int AS count FROM tpa.audit_events WHERE actor_user_id=$1 AND entity_id=$2 AND action='document.reviewed'",
              [people[2], id],
            )
          ).rows[0].count,
          1,
        );
        await pool.query("DELETE FROM tpa.staff_roles WHERE user_id=$1", [
          people[2],
        ]);
        await pool.query(
          "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'finance_operator')",
          [people[2]],
        );
        assert.equal((await request("/api/documents/" + id, 2)).status, 404);
      }
      const out = await request("/api/auth/sign-out", 0, {
        method: "POST",
        headers: { origin: base!, "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(out.status, 200);
      assert.equal((await request("/api/member/profile", 0)).status, 401);
      await pool.query('DELETE FROM public."session" WHERE "userId"=$1', [
        people[1],
      ]);
      assert.equal((await request("/api/documents", 1)).status, 401);
    } finally {
      for (const id of uploaded)
        if (storage)
          await storage.send(
            new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME!,
              Key: privateObjectKey(id),
            }),
          );
      storage?.destroy();
      for (const id of people) {
        for (const table of [
          "private_documents",
          "audit_events",
          "newsletter_consents",
          "member_profiles",
        ]) {
          const column =
            table === "private_documents"
              ? "owner_user_id"
              : table === "audit_events"
                ? "actor_user_id"
                : "user_id";
          await pool.query(`DELETE FROM tpa.${table} WHERE ${column}=$1`, [id]);
        }
        await pool.query('DELETE FROM public."user" WHERE id=$1', [id]);
      }
      await pool.end();
    }
  },
);
