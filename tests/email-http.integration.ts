import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Webhook } from "svix";
import { databaseOptions } from "../src/lib/database-options";
const base = process.env.TPA_TEST_URL;
test(
  "inbox and deliveries enforce every role, stale writes, revoked sessions and verified webhooks",
  { skip: !base || !process.env.DATABASE_URL },
  async () => {
    assert.ok(/ci|acceptance|test/.test(process.env.TPA_DATABASE_NAME!));
    const pool = new Pool(databaseOptions()),
      ids = Array.from({ length: 7 }, () => randomUUID()),
      cookies: string[] = [],
      conversation = randomUUID();
    const roles = [
      "administrator",
      "communications_operator",
      "membership_reviewer",
      "content_editor",
      "event_operator",
      "finance_operator",
      null,
    ];
    const req = (path: string, index?: number, body?: unknown) =>
      fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          ...(index === undefined ? {} : { cookie: cookies[index] }),
          ...(body
            ? { "content-type": "application/json", origin: base! }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual",
      });
    try {
      for (let i = 0; i < ids.length; i++) {
        const token = randomBytes(32).toString("hex");
        await pool.query(
          'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Email HTTP fixture\',$2,true)',
          [ids[i], ids[i] + "@example.invalid"],
        );
        await pool.query(
          'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
          [randomUUID(), token, ids[i]],
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
        if (roles[i])
          await pool.query(
            "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,$2)",
            [ids[i], roles[i]],
          );
      }
      for (const path of ["/api/staff/inbox", "/api/staff/deliveries"]) {
        assert.equal((await req(path)).status, 401);
        for (let i = 0; i < 7; i++)
          assert.equal((await req(path, i)).status, i < 2 ? 200 : 403);
      }
      await pool.query(
        "INSERT INTO tpa.email_conversations(id,subject,correspondent,reply_to) VALUES($1,'HTTP fixture','test@example.invalid','test@example.invalid')",
        [conversation],
      );
      assert.equal(
        (
          await req("/api/staff/inbox", 0, {
            action: "draft",
            id: conversation,
            version: 1,
            body: "Saved reply",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await req("/api/staff/inbox", 0, {
            action: "draft",
            id: conversation,
            version: 1,
            body: "Stale reply",
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await req("/api/staff/inbox", 0, {
            action: "send",
            id: conversation,
            version: 2,
            draftVersion: 2,
          })
        ).status,
        400,
      );
      const id = "msg_http_" + randomUUID(),
        raw = JSON.stringify({
          type: "email.received",
          created_at: new Date().toISOString(),
          data: {
            email_id: "inbound_http",
            to: ["contact@updates.tpassociation.org"],
          },
        }),
        stamp = new Date(),
        w = new Webhook(process.env.RESEND_WEBHOOK_SECRET!);
      const send = (signature: string, payload = raw) =>
        fetch(base + "/api/webhooks/resend", {
          method: "POST",
          headers: {
            "svix-id": id,
            "svix-timestamp": String(Math.floor(stamp.getTime() / 1000)),
            "svix-signature": signature,
          },
          body: payload,
        });
      assert.equal((await send("v1,forged")).status, 400);
      const sig = w.sign(id, stamp, raw);
      assert.equal((await send(sig)).status, 200);
      assert.equal((await send(sig)).status, 200);
      assert.equal((await send(sig, raw + " ")).status, 400);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM tpa.email_jobs WHERE payload->>'emailId'='inbound_http'",
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (await req("/api/email/unsubscribe?token=invalid")).status,
        400,
      );
      await pool.query('DELETE FROM public."session" WHERE "userId"=$1', [
        ids[0],
      ]);
      assert.equal((await req("/api/staff/inbox", 0)).status, 401);
    } finally {
      await pool.query(
        "DELETE FROM tpa.email_jobs WHERE payload->>'emailId'='inbound_http'",
      );
      await pool.query(
        "DELETE FROM tpa.email_events WHERE provider_id='inbound_http'",
      );
      await pool.query("DELETE FROM tpa.email_conversations WHERE id=$1", [
        conversation,
      ]);
      await pool.query(
        "DELETE FROM tpa.audit_events WHERE actor_user_id=ANY($1::text[])",
        [ids],
      );
      await pool.query(
        "DELETE FROM tpa.staff_roles WHERE user_id=ANY($1::text[])",
        [ids],
      );
      await pool.query(
        'DELETE FROM public."session" WHERE "userId"=ANY($1::text[])',
        [ids],
      );
      await pool.query('DELETE FROM public."user" WHERE id=ANY($1::text[])', [
        ids,
      ]);
      await pool.end();
    }
  },
);
