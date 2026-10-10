import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { databaseOptions } from "../src/lib/database-options";
const base = process.env.TPA_TEST_URL;
test(
  "staff search and attention isolate every role, ownership and hostile query input",
  {
    skip:
      !base ||
      !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"),
  },
  async () => {
    const db = new Pool(databaseOptions());
    const roles = [
      "administrator",
      "membership_reviewer",
      "content_editor",
      "event_operator",
      "communications_operator",
      "finance_operator",
      "member",
    ];
    const marker = "ux" + randomUUID().replaceAll("-", "");
    const ids: string[] = [],
      cookies: string[] = [];
    try {
      for (const role of roles) {
        const id = randomUUID(),
          token = randomBytes(24).toString("hex");
        ids.push(id);
        await db.query(
          'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
          [id, marker + " " + role, id + "@example.invalid"],
        );
        await db.query(
          'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
          [randomUUID(), token, id],
        );
        if (role !== "member")
          await db.query(
            "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,$2)",
            [id, role],
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
      const eventId = randomUUID();
      await db.query(
        "INSERT INTO tpa.events(id,title,description,location,starts_at,ends_at,capacity,updated_by) VALUES($1,$2,'Test description','Test venue',now(),now()+interval '1 hour',5,$3)",
        [eventId, marker, ids[0]],
      );
      const contentId = randomUUID();
      await db.query(
        "INSERT INTO tpa.content_entries(id,slug,kind,draft,updated_by) VALUES($1,$2,'page',$3,$4)",
        [contentId, marker, JSON.stringify({ title: marker }), ids[0]],
      );
      const inquiryId = randomUUID();
      await db.query(
        "INSERT INTO tpa.inquiries(id,user_id,subject,message) VALUES($1,$2,$3,$4)",
        [inquiryId, ids[6], marker, "Synthetic inquiry message"],
      );
      const privateBatch = randomUUID();
      await db.query(
        "INSERT INTO tpa.onboarding_batches(id,actor_id,rows) VALUES($1,$2,'[]')",
        [privateBatch, ids[1]],
      );
      for (let i = 0; i < roles.length; i++) {
        const response = await fetch(base + "/api/staff/search?q=" + marker, {
          headers: { cookie: cookies[i] },
        });
        if (i === 6) {
          assert.equal(response.status, 403);
          continue;
        }
        assert.equal(response.status, 200);
        assert.match(response.headers.get("cache-control") || "", /no-store/);
        const { results } = await response.json();
        assert.ok(results.length <= 30);
        const groups = new Set(results.map((x: { group: string }) => x.group));
        if (i === 1) {
          assert.ok(groups.has("Members"));
          assert.ok(!groups.has("Events"));
          assert.ok(!groups.has("Content"));
          assert.ok(!groups.has("Inquiries"));
        }
        if (i === 2) {
          assert.ok(groups.has("Content"));
          assert.ok(!groups.has("Members"));
        }
        if (i === 3) {
          assert.ok(groups.has("Events"));
          assert.ok(!groups.has("Members"));
        }
        if (i === 4) {
          assert.ok(groups.has("Inquiries"));
          assert.ok(!groups.has("Members"));
        }
        if (i === 5) assert.equal(results.length, 0);
        const alertResponse = await fetch(base + "/api/attention", {
          headers: { cookie: cookies[i] },
        });
        assert.equal(alertResponse.status, 200);
        const { items } = await alertResponse.json();
        if (i === 3 || i === 5) assert.equal(items.length, 0);
        if (i === 1)
          assert.ok(
            items.every(
              (x: { category: string }) => x.category === "Verification",
            ),
          );
        if (i === 2)
          assert.ok(
            items.every(
              (x: { category: string }) => x.category === "Publication",
            ),
          );
      }
      for (const q of ["%' OR 1=1 --", "_", "\\", "a".repeat(200)]) {
        const response = await fetch(
          base + "/api/staff/search?q=" + encodeURIComponent(q),
          { headers: { cookie: cookies[0] } },
        );
        assert.equal(response.status, 200);
        assert.ok((await response.json()).results.length <= 30);
      }
      const batchResponse = await fetch(
        base + "/api/staff/search?q=" + privateBatch,
        { headers: { cookie: cookies[0] } },
      );
      assert.ok(
        !(await batchResponse.json()).results.some(
          (x: { id: string }) => x.id === privateBatch,
        ),
      );
      const anonymous = await fetch(base + "/api/staff/search?q=" + marker);
      assert.equal(anonymous.status, 401);
      const own = await fetch(base + "/api/attention", {
        headers: { cookie: cookies[6] },
      });
      assert.equal(own.status, 200);
      assert.ok(
        (await own.json()).items.every((x: { href: string }) =>
          x.href.startsWith("/member"),
        ),
      );
    } finally {
      await db.end();
    }
  },
);
