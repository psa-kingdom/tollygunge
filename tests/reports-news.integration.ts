import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import ExcelJS from "exceljs";
import { databaseOptions } from "../src/lib/database-options";
const base = process.env.TPA_TEST_URL;
test(
  "staff reports, safe workbooks, scoped presets and editorial source review",
  {
    skip: !base || !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET,
  },
  async () => {
    const pool = new Pool(databaseOptions()),
      people = Array.from({ length: 8 }, () => randomUUID()),
      cookies: string[] = [],
      limitEvents: string[] = [],
      presets: string[] = [],
      sources: string[] = [],
      marker = `ReportFixture-${randomUUID()}`;
    const roleList = [
      "administrator",
      "membership_reviewer",
      "content_editor",
      "event_operator",
      "communications_operator",
      "finance_operator",
      null,
      "membership_reviewer",
    ];
    const request = (
      path: string,
      index?: number,
      body?: object,
      origin = base!,
    ) =>
      fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          ...(index === undefined ? {} : { cookie: cookies[index] }),
          ...(body ? { "content-type": "application/json", origin } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    try {
      for (let i = 0; i < people.length; i++) {
        const token = randomBytes(32).toString("hex");
        await pool.query(
          'INSERT INTO public."user"(id,name,email,"emailVerified","createdAt") VALUES($1,$2,$3,true,$4)',
          [
            people[i],
            i === 7 ? `=SUM(1,2) ${marker}` : marker,
            people[i] + "@example.invalid",
            "2026-04-01T18:29:59Z",
          ],
        );
        await pool.query(
          'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
          [randomUUID(), token, people[i]],
        );
        cookies.push(
          (base!.startsWith("https:") ? "__Secure-" : "") +
            "better-auth.session_token=" +
            encodeURIComponent(
              token +
                "." +
                createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
                  .update(token)
                  .digest("base64"),
            ),
        );
        if (roleList[i])
          await pool.query(
            "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,$2)",
            [people[i], roleList[i]],
          );
        await pool.query(
          "INSERT INTO tpa.member_profiles(user_id,phone,organization) VALUES($1,$2,$3)",
          [people[i], i === 7 ? "+919999999999" : "", marker],
        );
      }
      for (const path of [
        "/api/staff/reports",
        "/api/staff/report-presets",
        "/api/staff/news-sources",
        "/api/staff/reports/export?report=accounts&format=xlsx",
      ]) {
        assert.equal((await request(path)).status, 401);
        assert.equal((await request(path, 6)).status, 403);
      }
      const expected = [
        ["accounts", "events", "inquiries", "content", "newsletter"],
        ["accounts"],
        ["content"],
        ["events"],
        ["inquiries", "newsletter"],
        [],
      ];
      for (let i = 0; i < 6; i++)
        assert.deepEqual(
          (await (await request("/api/staff/reports?catalog=true", i)).json())
            .available,
          expected[i],
        );
      for (let i = 1; i < 6; i++)
        for (const r of [
          "accounts",
          "events",
          "inquiries",
          "content",
          "newsletter",
        ])
          assert.equal(
            (await request(`/api/staff/reports?report=${r}`, i)).status,
            expected[i].includes(r) ? 200 : 403,
          );
      const query = new URLSearchParams({
        report: "accounts",
        q: marker,
        from: "2026-04-01",
        to: "2026-04-01",
        contact: "phone",
        verification: "verified",
        review: "unverified",
      });
      const preview = await (
        await request(`/api/staff/reports?${query}`, 1)
      ).json();
      assert.equal(preview.rows.length, 1);
      assert.equal(preview.rows[0].phone, "+919999999999");
      assert.equal(preview.rows[0].profile_review, "unverified");
      const directory = await (
        await request(
          `/api/staff/members?q=${marker}&contact=phone&verification=verified&review=unverified`,
          1,
        )
      ).json();
      assert.equal(directory.total, 1);
      assert.equal(directory.rows[0].name, preview.rows[0].name);
      const csvResponse = await request(
        `/api/staff/reports/export?${query}&format=csv`,
        1,
      );
      assert.equal(csvResponse.status, 200);
      assert.equal(
        csvResponse.headers.get("cache-control"),
        "private, no-store",
      );
      const csv = await csvResponse.text();
      assert.ok(csv.includes(`"'=SUM(1,2) ${marker}"`));
      assert.ok(csv.includes("'+919999999999"));
      const xlsx = await request(
        `/api/staff/reports/export?${query}&format=xlsx`,
        1,
      );
      assert.equal(xlsx.status, 200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(await xlsx.arrayBuffer()) as never);
      const sheet = workbook.getWorksheet("Report")!;
      assert.equal(sheet.rowCount, 2);
      assert.equal(sheet.getCell("A2").value, preview.rows[0].name);
      assert.equal(sheet.getCell("A2").type, ExcelJS.ValueType.String);
      assert.equal(sheet.getCell("F2").value, "+919999999999");
      assert.equal(sheet.getCell("C2").value, true);
      assert.equal(sheet.views[0].state, "frozen");
      assert.ok(sheet.autoFilter);
      assert.ok(
        workbook
          .getWorksheet("Metadata")!
          .getCell("B8")
          .text.includes("2026-04-01"),
      );
      query.set("to", "2026-03-31");
      assert.equal(
        (await request(`/api/staff/reports/export?${query}&format=csv`, 1))
          .status,
        400,
      );
      query.set("from", "2026-04-02");
      query.set("to", "2026-04-02");
      const empty = await (
        await request(`/api/staff/reports?${query}`, 1)
      ).json();
      assert.equal(empty.rows.length, 0);
      const emptyBook = new ExcelJS.Workbook();
      await emptyBook.xlsx.load(
        Buffer.from(
          await (
            await request(`/api/staff/reports/export?${query}&format=xlsx`, 1)
          ).arrayBuffer(),
        ) as never,
      );
      assert.equal(emptyBook.getWorksheet("Report")!.rowCount, 1);
      const save = {
        action: "save",
        version: 0,
        name: marker,
        visibility: "private",
        report: "accounts",
        filters: { period: "financial", q: marker },
      };
      assert.equal(
        (
          await request(
            "/api/staff/report-presets",
            1,
            save,
            "https://example.invalid",
          )
        ).status,
        403,
      );
      const own = await (
        await request("/api/staff/report-presets", 1, save)
      ).json();
      presets.push(own.preset.id);
      assert.equal(own.preset.filters.period, "financial");
      assert.ok(!JSON.stringify(own.preset).includes("rows"));
      assert.ok(
        !(
          await (await request("/api/staff/report-presets", 7)).json()
        ).presets.some((p: { id: string }) => p.id === own.preset.id),
      );
      assert.equal(
        (
          await request("/api/staff/report-presets", 7, {
            ...save,
            id: own.preset.id,
            version: 1,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/staff/report-presets", 0, {
            ...save,
            id: own.preset.id,
            version: 1,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/staff/report-presets", 1, {
            ...save,
            id: own.preset.id,
            version: 0,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request("/api/staff/report-presets", 1, {
            ...save,
            visibility: "shared",
          })
        ).status,
        403,
      );
      const shared = await (
        await request("/api/staff/report-presets", 0, {
          ...save,
          visibility: "shared",
        })
      ).json();
      presets.push(shared.preset.id);
      assert.ok(
        (
          await (await request("/api/staff/report-presets", 1)).json()
        ).presets.some((p: { id: string }) => p.id === shared.preset.id),
      );
      assert.ok(
        !(
          await (await request("/api/staff/report-presets", 2)).json()
        ).presets.some((p: { id: string }) => p.id === shared.preset.id),
      );
      assert.equal(
        (
          await request("/api/staff/report-presets", 1, {
            action: "delete",
            id: shared.preset.id,
            version: 1,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/staff/report-presets", 1, {
            ...save,
            report: "events",
          })
        ).status,
        403,
      );
      const sourceInput = {
        action: "save",
        version: 0,
        name: marker,
        url: "https://example.invalid/news",
        type: "rss",
        notes: "Synthetic source; never fetched.",
      };
      assert.equal(
        (await request("/api/staff/news-sources", 1, sourceInput)).status,
        403,
      );
      assert.equal(
        (
          await request("/api/staff/news-sources", 2, {
            ...sourceInput,
            url: "javascript:alert(1)",
          })
        ).status,
        400,
      );
      let source = (
        await (await request("/api/staff/news-sources", 2, sourceInput)).json()
      ).source;
      sources.push(source.id);
      assert.equal(source.status, "draft");
      assert.equal(
        (
          await request("/api/staff/news-sources", 2, {
            action: "approve",
            id: source.id,
            version: 1,
          })
        ).status,
        403,
      );
      source = (
        await (
          await request("/api/staff/news-sources", 0, {
            action: "approve",
            id: source.id,
            version: 1,
          })
        ).json()
      ).source;
      assert.equal(source.status, "approved");
      assert.equal(
        (
          await request("/api/staff/news-sources", 0, {
            action: "pause",
            id: source.id,
            version: 1,
          })
        ).status,
        409,
      );
      source = (
        await (
          await request("/api/staff/news-sources", 2, {
            ...sourceInput,
            id: source.id,
            version: 2,
            notes: "Changed source",
          })
        ).json()
      ).source;
      assert.equal(source.status, "draft");
      assert.equal(
        (
          await request("/api/staff/news-sources", 0, {
            action: "pause",
            id: source.id,
            version: 3,
          })
        ).status,
        409,
      );
      source = (
        await (
          await request("/api/staff/news-sources", 0, {
            action: "approve",
            id: source.id,
            version: 3,
          })
        ).json()
      ).source;
      source = (
        await (
          await request("/api/staff/news-sources", 0, {
            action: "pause",
            id: source.id,
            version: 4,
          })
        ).json()
      ).source;
      assert.equal(source.status, "paused");
      const history = await (
        await request(`/api/staff/news-sources?id=${source.id}`, 2)
      ).json();
      assert.equal(history.collectionEnabled, false);
      assert.equal(history.revisions.length, 5);
      assert.equal(history.revisions[0].snapshot.status, "paused");
      if (process.env.CI === "true") {
        const records = await pool.query(
          "INSERT INTO tpa.events(id,title,description,location,starts_at,ends_at,capacity,updated_by) SELECT gen_random_uuid(),$1,'','Synthetic export limit','2096-04-01T00:00:00Z'::timestamptz,'2096-04-01T01:00:00Z'::timestamptz,1,$2 FROM generate_series(1,10001) RETURNING id",
          [marker, people[0]],
        );
        limitEvents.push(...records.rows.map((row) => row.id));
        const limitQuery = "report=events&from=2096-04-01&to=2096-04-01";
        const limited = await (
          await request(`/api/staff/reports?${limitQuery}`, 3)
        ).json();
        assert.equal(limited.rows.length, 200);
        assert.equal(limited.previewLimited, true);
        for (const format of ["csv", "xlsx"]) {
          const response = await request(
            `/api/staff/reports/export?${limitQuery}&format=${format}`,
            3,
          );
          assert.equal(response.status, 400);
          assert.match((await response.json()).error, /10,000/);
        }
      }
      await pool.query("DELETE FROM tpa.staff_roles WHERE user_id=$1", [
        people[1],
      ]);
      assert.equal((await request("/api/staff/report-presets", 1)).status, 403);
      assert.equal(
        (
          await request(
            "/api/staff/reports/export?report=accounts&format=csv",
            1,
          )
        ).status,
        403,
      );
      await pool.query('DELETE FROM public."session" WHERE "userId"=$1', [
        people[0],
      ]);
      assert.equal((await request("/api/staff/news-sources", 0)).status, 401);
    } finally {
      await pool.query("DELETE FROM tpa.events WHERE id=ANY($1::uuid[])", [
        limitEvents,
      ]);
      await pool.query(
        "DELETE FROM tpa.news_sources WHERE id=ANY($1::uuid[])",
        [sources],
      );
      await pool.query(
        "DELETE FROM tpa.report_presets WHERE id=ANY($1::uuid[])",
        [presets],
      );
      await pool.query(
        "DELETE FROM tpa.audit_events WHERE actor_user_id=ANY($1::text[])",
        [people],
      );
      await pool.query(
        "DELETE FROM tpa.member_profiles WHERE user_id=ANY($1::text[])",
        [people],
      );
      await pool.query(
        "DELETE FROM tpa.staff_roles WHERE user_id=ANY($1::text[])",
        [people],
      );
      await pool.query('DELETE FROM public."user" WHERE id=ANY($1::text[])', [
        people,
      ]);
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM public."user" WHERE id=ANY($1::text[])',
            [people],
          )
        ).rows[0].n,
        0,
      );
      await pool.end();
    }
  },
);
