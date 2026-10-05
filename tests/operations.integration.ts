import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
const base = process.env.TPA_TEST_URL;
test(
  "operational slices isolate drafts, serialize registration, audit attendance and protect CRM",
  {
    skip: !base || !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET,
  },
  async () => {
    const pool = new Pool(databaseOptions()),
      people = [randomUUID(), randomUUID(), randomUUID(), randomUUID()],
      cookies: string[] = [],
      contentIds: string[] = [],
      eventIds: string[] = [],
      inquiryIds: string[] = [],
      templateIds: string[] = [];
    try {
      for (const id of people) {
        await pool.query(
          'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Operations fixture\',$2,true)',
          [id, `${id}@example.invalid`],
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
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator'),($2,'content_editor')",
        [people[0], people[3]],
      );
      const request = (path: string, person?: number, body?: object) =>
        fetch(base + path, {
          method: body ? "POST" : "GET",
          redirect: "manual",
          headers: {
            ...(person !== undefined ? { cookie: cookies[person] } : {}),
            ...(body
              ? { "content-type": "application/json", origin: base! }
              : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      for (const path of [
        "/api/staff/content",
        "/api/staff/events",
        "/api/staff/crm",
        "/api/staff/communications",
        "/api/staff/flyers",
        "/api/staff/access",
        "/api/staff/audit",
        "/api/member/application",
        "/api/member/events",
        "/api/member/inquiries",
      ])
        assert.equal((await request(path)).status, 401);
      assert.equal((await request("/api/staff/content", 1)).status, 403);
      assert.equal((await request("/api/staff/access", 3)).status, 403);
      assert.equal((await request("/api/staff/audit", 1)).status, 403);
      assert.equal(
        (await request("/api/staff/audit?before=9223372036854775808", 0))
          .status,
        400,
      );
      assert.equal(
        (
          await request("/api/staff/access", 0, {
            id: people[0],
            roles: [],
            expectedRoles: ["administrator"],
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request("/api/staff/access", 0, {
            id: people[3],
            roles: ["invented"],
            expectedRoles: ["content_editor"],
          })
        ).status,
        400,
      );
      const access = await (
        await request(`/api/staff/access?q=${encodeURIComponent(people[3])}`, 0)
      ).json();
      assert.deepEqual(access.people[0].roles, ["content_editor"]);
      assert.equal(
        (
          await request("/api/staff/access", 0, {
            id: people[3],
            roles: ["content_editor"],
            expectedRoles: ["content_editor"],
          })
        ).status,
        200,
      );
      assert.equal(
        (await request("/api/staff/content", 3)).status,
        200,
        "no-op preserves sessions",
      );
      assert.equal(
        (await request("/api/staff/events", 3, { action: "save" })).status,
        403,
      );
      const slug = `synthetic-${randomUUID()}`,
        body = {
          title: "Synthetic editorial test",
          intro: "Synthetic only",
          sections: [
            {
              title: "Summary",
              text: "An original synthetic summary, not a copied article.",
            },
          ],
          sourceUrl: "https://example.invalid/source",
          attribution: "Synthetic publisher",
        };
      const saved = await request("/api/staff/content", 3, {
        action: "save",
        kind: "news",
        slug,
        version: 0,
        body,
      });
      assert.equal(saved.status, 200);
      const entry = await saved.json();
      contentIds.push(entry.id);
      assert.equal((await request(`/resources/${slug}`)).status, 404);
      const deniedPreview = await request(`/admin/content/${entry.id}`, 1);
      assert.equal(deniedPreview.status, 307);
      assert.ok(deniedPreview.headers.get("location")?.endsWith("/member"));
      assert.equal(
        (await request(`/admin/content/${entry.id}`, 3)).status,
        200,
      );
      const publish = await request("/api/staff/content", 3, {
        action: "publish",
        id: entry.id,
        version: entry.version,
      });
      assert.equal(publish.status, 200);
      const live = await publish.json();
      assert.equal((await request(`/resources/${slug}`)).status, 200);
      assert.equal(
        (
          await request("/api/staff/content", 3, {
            action: "save",
            id: entry.id,
            version: entry.version,
            kind: "news",
            slug,
            body,
          })
        ).status,
        409,
      );
      const edited = await request("/api/staff/content", 3, {
        action: "save",
        id: entry.id,
        version: live.version,
        kind: "news",
        slug,
        body: { ...body, title: "PRIVATE EDIT NOT PUBLISHED" },
      });
      assert.equal(edited.status, 200);
      const draft = await edited.json();
      assert.ok(
        !(await (await request(`/resources/${slug}`)).text()).includes(
          "PRIVATE EDIT NOT PUBLISHED",
        ),
      );
      assert.equal(
        (
          await request("/api/staff/content", 3, {
            action: "unpublish",
            id: entry.id,
            version: draft.version,
          })
        ).status,
        200,
      );
      assert.equal((await request(`/resources/${slug}`)).status, 404);
      const application = {
        version: 0,
        plan: "Annual",
        category: "Student",
        details: {
          fullName: "Synthetic applicant",
          institution: "Synthetic college",
        },
        documentIds: [],
        userId: people[2],
        status: "approved",
      };
      const draftResponse = await request(
        "/api/member/application",
        1,
        application,
      );
      assert.equal(draftResponse.status, 200);
      const app = await draftResponse.json();
      assert.equal(app.user_id, people[1]);
      assert.equal(app.status, "draft");
      assert.equal(app.checkoutAvailable, false);
      assert.equal(
        await (await request("/api/member/application", 2)).json(),
        null,
      );
      assert.equal(
        (await request("/api/member/application", 1, application)).status,
        409,
      );
      const foreignDoc = randomUUID();
      await pool.query(
        "INSERT INTO tpa.private_documents(id,owner_user_id,kind,content_type,byte_size) VALUES($1,$2,'certificate','application/pdf',10)",
        [foreignDoc, people[2]],
      );
      assert.equal(
        (
          await request("/api/member/application", 1, {
            ...application,
            version: app.version,
            documentIds: [foreignDoc],
          })
        ).status,
        403,
      );
      const startsAt = new Date(Date.now() + 3600000).toISOString(),
        endsAt = new Date(Date.now() + 7200000).toISOString();
      const eventResponse = await request("/api/staff/events", 0, {
        action: "save",
        version: 0,
        title: "Synthetic capacity event",
        description: "Synthetic test only",
        location: "Test venue",
        startsAt,
        endsAt,
        capacity: 1,
      });
      assert.equal(eventResponse.status, 200);
      const event = await eventResponse.json();
      eventIds.push(event.id);
      assert.equal((await request(`/events/${event.id}`)).status, 404);
      const eventPublished = await request("/api/staff/events", 0, {
        action: "publish",
        id: event.id,
        version: event.version,
      });
      assert.equal(eventPublished.status, 200);
      const published = await eventPublished.json();
      assert.equal((await request(`/events/${event.id}`)).status, 200);
      const races = await Promise.all([
        request("/api/member/events", 1, {
          action: "register",
          eventId: event.id,
        }),
        request("/api/member/events", 2, {
          action: "register",
          eventId: event.id,
        }),
      ]);
      assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
      const winner = races[0].status === 200 ? 1 : 2;
      const registered = await races[winner - 1].json();
      const duplicate = await request("/api/member/events", winner, {
        action: "register",
        eventId: event.id,
      });
      assert.equal((await duplicate.json()).id, registered.id);
      assert.equal(
        (
          await request("/api/staff/attendance", 0, {
            registrationId: registered.id,
          })
        ).status,
        409,
      );
      await pool.query(
        "UPDATE tpa.events SET starts_at=now()-interval '1 minute' WHERE id=$1",
        [event.id],
      );
      assert.equal(
        (
          await request("/api/staff/attendance", 0, {
            registrationId: registered.id,
          })
        ).status,
        200,
      );
      const repeated = await (
        await request("/api/staff/attendance", 0, {
          registrationId: registered.id,
        })
      ).json();
      assert.equal(repeated.duplicate, true);
      assert.equal(repeated.learningHours, null);
      const csv = `email,event_id,attended_at\n${people[winner]}@example.invalid,${event.id},${new Date().toISOString()}`;
      const importPreview = await request("/api/staff/imports", 0, {
        action: "preview",
        filename: "synthetic-history.csv",
        csv,
      });
      assert.equal(importPreview.status, 200);
      const preview = await importPreview.json();
      assert.equal(preview.commitEnabled, false);
      assert.ok(
        preview.rows[0].errors.some((error: string) =>
          error.includes("Attendance already exists"),
        ),
      );
      assert.equal(
        (
          await request("/api/staff/imports", 1, {
            action: "preview",
            filename: "synthetic-history.csv",
            csv,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/staff/imports", 0, {
            action: "commit",
            filename: "synthetic-history.csv",
            csv,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM tpa.event_attendance WHERE registration_id=$1",
            [registered.id],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM tpa.audit_events WHERE entity_id=$1 AND action='attendance.checked_in'",
            [registered.id],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await request("/api/staff/flyers", 0, {
            eventId: event.id,
            version: 0,
            speakers: [
              { name: "Synthetic speaker", credentials: "Professional" },
            ],
          })
        ).status,
        200,
      );
      assert.equal((await request("/api/staff/flyers", 1)).status, 403);
      assert.equal(
        (
          await request("/api/staff/events", 0, {
            action: "cancel",
            id: event.id,
            version: published.version,
          })
        ).status,
        200,
      );
      assert.equal((await request(`/events/${event.id}`)).status, 404);
      const history = await (
        await request("/api/member/events", winner)
      ).json();
      assert.ok(
        history.some(
          (row: { id: string; checked_in_at: string; status: string }) =>
            row.id === event.id &&
            row.checked_in_at &&
            row.status === "cancelled",
        ),
      );
      const inquiry = await request("/api/member/inquiries", 1, {
        subject: "Synthetic inquiry",
        message: "Synthetic inquiry for staff review.",
      });
      assert.equal(inquiry.status, 200);
      const record = await inquiry.json();
      inquiryIds.push(record.id);
      assert.equal(
        (await (await request("/api/member/inquiries", 2)).json()).length,
        0,
      );
      const staff = await (
        await request(`/api/staff/crm?id=${record.id}`, 0)
      ).json();
      const crm = staff.records.find(
        (row: { id: string }) => row.id === record.id,
      );
      assert.ok(crm);
      assert.equal(
        (
          await request("/api/staff/crm", 0, {
            id: crm.id,
            version: crm.version,
            status: "contacted",
            assignedTo: people[3],
            note: "Wrong domain assignee",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("/api/staff/crm", 0, {
            id: crm.id,
            version: crm.version,
            status: "contacted",
            assignedTo: people[0],
            followUpAt: new Date().toISOString(),
            note: "PRIVATE STAFF NOTE",
          })
        ).status,
        200,
      );
      const own = await (await request("/api/member/inquiries", 1)).json();
      assert.ok(!JSON.stringify(own).includes("PRIVATE STAFF NOTE"));
      const template = await request("/api/staff/communications", 0, {
        action: "save",
        version: 0,
        name: "Synthetic template",
        subject: "Synthetic subject",
        body: "A synthetic message that will never be sent.",
      });
      assert.equal(template.status, 200);
      templateIds.push((await template.json()).id);
      assert.equal(
        (await request("/api/staff/communications", 0, { action: "send" }))
          .status,
        409,
      );
      const comms = await (
        await request("/api/staff/communications", 0)
      ).json();
      assert.equal(comms.deliveryEnabled, false);
      assert.equal(comms.provider, "Resend");
      const editorReports = await (
        await request("/api/staff/reports", 3)
      ).json();
      assert.deepEqual(Object.keys(editorReports), ["content"]);
      assert.equal((await request("/api/staff/reports", 1)).status, 403);
      const changed = await request("/api/staff/access", 0, {
        id: people[3],
        roles: ["event_operator"],
        expectedRoles: ["content_editor"],
      });
      assert.equal(changed.status, 200);
      assert.equal((await changed.json()).sessionsRevoked, true);
      assert.equal((await request("/api/staff/content", 3)).status, 401);
      assert.equal(
        (
          await request("/api/staff/access", 0, {
            id: people[3],
            roles: [],
            expectedRoles: ["content_editor"],
          })
        ).status,
        409,
      );
      const logs = await (await request("/api/staff/audit", 0)).json();
      assert.ok(
        logs.entries.some(
          (row: { action: string; entity_id: string }) =>
            row.entity_id === people[3] &&
            row.action === "staff.role_removed:content_editor",
        ),
      );
      assert.ok(
        logs.entries.some(
          (row: { action: string; entity_id: string }) =>
            row.entity_id === people[3] &&
            row.action === "staff.role_granted:event_operator",
        ),
      );
      await pool.query(
        'UPDATE public."user" SET "emailVerified"=false WHERE id=$1',
        [people[3]],
      );
      assert.equal(
        (
          await request("/api/staff/access", 0, {
            id: people[3],
            roles: ["finance_operator"],
            expectedRoles: ["event_operator"],
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request("/api/staff/access", 0, {
            id: people[3],
            roles: [],
            expectedRoles: ["event_operator"],
          })
        ).status,
        200,
      );
      await pool.query(
        'UPDATE public."user" SET "emailVerified"=true WHERE id=$1',
        [people[3]],
      );
      assert.equal(
        (
          await request("/api/staff/access", 0, {
            id: people[3],
            roles: ["administrator"],
            expectedRoles: [],
          })
        ).status,
        200,
      );
      const freshToken = randomBytes(32).toString("hex");
      await pool.query(
        'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
        [randomUUID(), freshToken, people[3]],
      );
      cookies[3] =
        "better-auth.session_token=" +
        encodeURIComponent(
          freshToken +
            "." +
            createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
              .update(freshToken)
              .digest("base64"),
        );
      const crossRemoval = await Promise.all([
        request("/api/staff/access", 0, {
          id: people[3],
          roles: [],
          expectedRoles: ["administrator"],
        }),
        request("/api/staff/access", 3, {
          id: people[0],
          roles: [],
          expectedRoles: ["administrator"],
        }),
      ]);
      assert.equal(
        crossRemoval.filter((r) => r.status === 200).length,
        1,
        "concurrent administrator removal must have only one winner",
      );
      assert.ok(crossRemoval.some((r) => [401, 403].includes(r.status)));
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM tpa.staff_roles WHERE user_id=ANY($1::text[]) AND role='administrator'",
            [[people[0], people[3]]],
          )
        ).rows[0].n,
        1,
      );
    } finally {
      for (const id of templateIds)
        await pool.query(
          "DELETE FROM tpa.communication_templates WHERE id=$1",
          [id],
        );
      for (const id of inquiryIds) {
        await pool.query(
          "DELETE FROM tpa.inquiry_updates WHERE inquiry_id=$1",
          [id],
        );
        await pool.query("DELETE FROM tpa.inquiry_notes WHERE inquiry_id=$1", [
          id,
        ]);
        await pool.query("DELETE FROM tpa.inquiries WHERE id=$1", [id]);
      }
      for (const id of eventIds) {
        await pool.query("DELETE FROM tpa.flyer_templates WHERE event_id=$1", [
          id,
        ]);
        await pool.query(
          "DELETE FROM tpa.event_attendance WHERE registration_id IN (SELECT id FROM tpa.event_registrations WHERE event_id=$1)",
          [id],
        );
        await pool.query(
          "DELETE FROM tpa.event_registrations WHERE event_id=$1",
          [id],
        );
        await pool.query("DELETE FROM tpa.events WHERE id=$1", [id]);
      }
      for (const id of contentIds)
        await pool.query("DELETE FROM tpa.content_entries WHERE id=$1", [id]);
      for (const id of people) {
        await pool.query(
          "DELETE FROM tpa.application_drafts WHERE user_id=$1",
          [id],
        );
        await pool.query(
          "DELETE FROM tpa.private_documents WHERE owner_user_id=$1",
          [id],
        );
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
