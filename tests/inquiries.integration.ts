import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
const base = process.env.TPA_TEST_URL;
test(
  "public inquiry intake is durable, private, idempotent and organized by staff",
  {
    skip: !base || !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET,
  },
  async () => {
    const pool = new Pool(databaseOptions()),
      people = [randomUUID(), randomUUID(), randomUUID()],
      cookies: string[] = [],
      ids: string[] = [],
      prefix = `Inquiry fixture ${randomUUID()}`;
    const request = (
      path: string,
      body?: object,
      person?: number,
      origin = base!,
    ) =>
      fetch(base + path, {
        method: body ? "POST" : "GET",
        redirect: "manual",
        headers: {
          ...(person !== undefined ? { cookie: cookies[person] } : {}),
          ...(body ? { "content-type": "application/json", origin } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    const input = {
      submissionId: randomUUID(),
      name: "Synthetic Contact",
      email: randomUUID() + "@example.invalid",
      phone: "+919000000001",
      organization: "Synthetic Company",
      jobTitle: "Synthetic Role",
      location: "Synthetic City",
      topic: "Partnership",
      preference: "phone",
      subject: prefix,
      message: "A synthetic request to discuss professional collaboration.",
      source: "homepage",
      consent: true,
      website: "",
    };
    try {
      for (const id of people) {
        await pool.query(
          'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Inquiry fixture\',$2,true)',
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
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'communications_operator'),($2,'content_editor')",
        [people[0], people[2]],
      );
      assert.equal((await request("/api/inquiries")).status, 405);
      assert.equal(
        (
          await request(
            "/api/inquiries",
            input,
            undefined,
            "https://untrusted.invalid",
          )
        ).status,
        403,
      );
      for (const body of [
        { ...input, consent: false },
        { ...input, email: "broken" },
        { ...input, phone: "broken" },
        { ...input, website: "spam" },
        { ...input, message: "short" },
        { ...input, preference: "phone", phone: "" },
        { ...input, source: "invented" },
        { ...input, topic: "invented" },
      ])
        assert.equal((await request("/api/inquiries", body)).status, 400);
      const usersBefore = (
        await pool.query(
          'SELECT count(*)::int AS n FROM public."user" WHERE email=$1',
          [input.email],
        )
      ).rows[0].n;
      const responses = await Promise.all([
        request("/api/inquiries", input),
        request("/api/inquiries", input),
      ]);
      assert.ok(responses.every((r) => r.status === 200));
      const records = await Promise.all(responses.map((r) => r.json()));
      assert.equal(records[0].id, records[1].id);
      ids.push(records[0].id);
      assert.equal(
        (
          await request("/api/inquiries", {
            ...input,
            message: "Changed submission body should conflict.",
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM public."user" WHERE email=$1',
            [input.email],
          )
        ).rows[0].n,
        usersBefore,
      );
      const stored = (
        await pool.query("SELECT * FROM tpa.inquiries WHERE id=$1", ids)
      ).rows[0];
      assert.equal(stored.user_id, null);
      assert.equal(stored.status, "new");
      assert.equal(stored.contact_email, input.email);
      assert.equal(stored.organization, input.organization);
      assert.equal(stored.job_title, input.jobTitle);
      assert.equal(stored.location, input.location);
      assert.equal(stored.phone, input.phone);
      assert.equal(stored.source, "homepage");
      assert.ok(stored.consent_at);
      assert.equal((await request("/api/staff/crm")).status, 401);
      assert.equal((await request("/api/staff/crm", undefined, 1)).status, 403);
      assert.equal((await request("/api/staff/crm", undefined, 2)).status, 403);
      assert.equal(
        (await request("/api/member/inquiries", undefined, 1)).status,
        200,
      );
      assert.ok(
        !(
          await (await request("/api/member/inquiries", undefined, 1)).text()
        ).includes(input.email),
      );
      const detail = await (
        await request("/api/staff/crm?id=" + stored.id, undefined, 0)
      ).json();
      const row = detail.records[0];
      assert.equal(row.name, input.name);
      assert.equal(row.email, input.email);
      const update = {
        id: stored.id,
        version: row.version,
        status: "contacted",
        tags: ["Priority", "partnership"],
        assignedTo: people[0],
        followUpAt: "2026-01-01T09:00:00+05:30",
        note: "Synthetic private staff note",
      };
      assert.equal((await request("/api/staff/crm", update, 2)).status, 403);
      assert.equal(
        (await request("/api/staff/crm", { ...update, status: "invented" }, 0))
          .status,
        400,
      );
      assert.equal(
        (await request("/api/staff/crm", { ...update, tags: ["<script>"] }, 0))
          .status,
        400,
      );
      const updates = await Promise.all([
        request("/api/staff/crm", update, 0),
        request("/api/staff/crm", update, 0),
      ]);
      assert.deepEqual(updates.map((r) => r.status).sort(), [200, 409]);
      const refreshed = await (
        await request("/api/staff/crm?id=" + stored.id, undefined, 0)
      ).json();
      assert.equal(refreshed.records[0].history.length, 1);
      assert.deepEqual(refreshed.records[0].tags, ["priority", "partnership"]);
      for (const parameters of [
        "status=contacted",
        "tag=priority",
        "focus=overdue",
        "q=Synthetic%20Company",
      ]) {
        const filtered = await (
          await request("/api/staff/crm?" + parameters, undefined, 0)
        ).json();
        assert.ok(
          filtered.records.some((r: { id: string }) => r.id === stored.id),
        );
      }
      assert.equal(
        (await request("/api/staff/crm?page=0", undefined, 0)).status,
        400,
      );
      assert.equal(
        (await request("/api/staff/crm?status=broken", undefined, 0)).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/api/staff/crm",
            {
              ...update,
              version: refreshed.records[0].version,
              status: "closed",
              note: "",
              tags: ["completed"],
            },
            0,
          )
        ).status,
        200,
      );
      const closed = await (
        await request("/api/staff/crm?id=" + stored.id, undefined, 0)
      ).json();
      assert.equal(closed.records[0].history.length, 2);
      assert.equal(closed.records[0].status, "closed");
      const open = await (
        await request("/api/staff/crm?focus=active", undefined, 0)
      ).json();
      assert.ok(!open.records.some((r: { id: string }) => r.id === stored.id));
      const own = await request(
        "/api/inquiries",
        {
          ...input,
          submissionId: randomUUID(),
          email: people[1] + "@example.invalid",
          source: "contact",
        },
        1,
      );
      assert.equal(own.status, 200);
      ids.push((await own.json()).id);
      const mine = await (
        await request("/api/member/inquiries", undefined, 1)
      ).json();
      assert.equal(mine.length, 1);
      assert.ok(!JSON.stringify(mine).includes("staff note"));
      for (let n = 0; n < 2; n++) {
        const response = await request("/api/inquiries", {
          ...input,
          submissionId: randomUUID(),
        });
        assert.equal(response.status, 200);
        ids.push((await response.json()).id);
      }
      assert.equal(
        (
          await request("/api/inquiries", {
            ...input,
            submissionId: randomUUID(),
          })
        ).status,
        429,
      );
      assert.equal((await request("/api/inquiries", input)).status, 200); // retries still work after quota
      const paginationPrefix = `${prefix} pagination`;
      const pageIds = Array.from({ length: 52 }, () => randomUUID());
      ids.push(...pageIds);
      await pool.query(
        "INSERT INTO tpa.inquiries(id,user_id,subject,message) SELECT id,$2,$3,'Synthetic pagination inquiry only.' FROM unnest($1::uuid[]) id",
        [pageIds, people[1], paginationPrefix],
      );
      const first = await (
          await request(
            "/api/staff/crm?q=" + encodeURIComponent(paginationPrefix),
            undefined,
            0,
          )
        ).json(),
        second = await (
          await request(
            "/api/staff/crm?q=" +
              encodeURIComponent(paginationPrefix) +
              "&page=2",
            undefined,
            0,
          )
        ).json();
      assert.equal(first.total, 52);
      assert.equal(first.records.length, 50);
      assert.equal(second.records.length, 2);
      assert.equal(
        new Set([...first.records, ...second.records].map((r) => r.id)).size,
        52,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM tpa.audit_events WHERE entity_id=$1 AND action='inquiry.public_created' AND actor_user_id IS NULL",
            [stored.id],
          )
        ).rows[0].n,
        1,
      );
    } finally {
      await pool.query(
        "DELETE FROM tpa.inquiry_updates WHERE inquiry_id=ANY($1::uuid[])",
        [ids],
      );
      await pool.query(
        "DELETE FROM tpa.inquiry_notes WHERE inquiry_id=ANY($1::uuid[])",
        [ids],
      );
      await pool.query(
        "DELETE FROM tpa.audit_events WHERE entity_id=ANY($1::text[])",
        [ids],
      );
      await pool.query("DELETE FROM tpa.inquiries WHERE id=ANY($1::uuid[])", [
        ids,
      ]);
      for (const id of people) {
        await pool.query(
          "DELETE FROM tpa.audit_events WHERE actor_user_id=$1",
          [id],
        );
        await pool.query("DELETE FROM tpa.staff_roles WHERE user_id=$1", [id]);
        await pool.query('DELETE FROM public."session" WHERE "userId"=$1', [
          id,
        ]);
        await pool.query('DELETE FROM public."user" WHERE id=$1', [id]);
      }
      await pool.end();
    }
  },
);
