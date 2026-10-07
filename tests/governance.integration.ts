import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
const base = process.env.TPA_TEST_URL;
test(
  "people review keeps pending details private and enforces administrator decisions, groups and publication",
  {
    skip: !base || !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET,
  },
  async () => {
    const pool = new Pool(databaseOptions()),
      users = Array.from({ length: 5 }, () => randomUUID()),
      cookies: string[] = [],
      ids: string[] = [],
      groups: string[] = [],
      label = "Synthetic people " + randomUUID();
    const req = (path: string, actor?: number, body?: object) =>
      fetch(base + path, {
        method: body ? "POST" : "GET",
        redirect: "manual",
        headers: {
          ...(actor === undefined ? {} : { cookie: cookies[actor] }),
          ...(body
            ? { origin: base!, "content-type": "application/json" }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    async function ok(path: string, actor: number, body?: object) {
      const r = await req(path, actor, body);
      assert.equal(r.status, 200, `${path}: ${await r.clone().text()}`);
      return r.json();
    }
    try {
      for (const id of users) {
        await pool.query(
          'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'People fixture\',$2,true)',
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
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator'),($2,'finance_operator'),($3,'content_editor'),($4,'membership_reviewer')",
        [users[0], users[1], users[2], users[4]],
      );
      assert.equal((await req("/api/staff/governance")).status, 401);
      assert.equal((await req("/api/staff/governance", 1)).status, 403);
      assert.equal(
        (await req("/api/staff/profile-reviews", 2, { action: "approve" }))
          .status,
        403,
      );
      assert.equal(
        (await req("/api/staff/governance/preview?page=governance", 3)).status,
        403,
      );
      let root = await ok("/api/staff/profile-groups", 0, {
        action: "save",
        version: 0,
        body: {
          name: label + " group",
          page: "governance",
          section: 0,
          order: 7,
        },
      });
      groups.push(root.id);
      root = await ok("/api/staff/profile-groups", 0, {
        action: "publish",
        id: root.id,
        version: root.version,
      });
      let child = await ok("/api/staff/profile-groups", 0, {
        action: "save",
        version: 0,
        parentId: root.id,
        body: {
          name: "Synthetic subgroup",
          page: "about",
          section: 2,
          order: 8,
        },
      });
      groups.push(child.id);
      child = await ok("/api/staff/profile-groups", 0, {
        action: "publish",
        id: child.id,
        version: child.version,
      });
      assert.equal(
        (
          await req("/api/staff/profile-groups", 0, {
            action: "save",
            version: 0,
            parentId: child.id,
            body: {
              name: "Invalid third level",
              page: "about",
              section: 0,
              order: 0,
            },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await req("/api/staff/profile-groups", 0, {
            action: "archive",
            id: root.id,
            version: root.version,
          })
        ).status,
        400,
      );
      const body = {
        name: label,
        phone: "+91 1234567890",
        organization: "Synthetic company",
        profession: "Professional",
        jobTitle: "Partner",
        city: "Kolkata",
        biography: "Synthetic biography",
        portraitId: null,
        links: [
          {
            platform: "LinkedIn",
            label: "LinkedIn",
            url: "https://www.linkedin.com/in/example",
            public: true,
          },
          {
            platform: "Website",
            label: "Private link",
            url: "https://example.com/private-profile",
            public: false,
          },
        ],
        assignments: [
          { groupId: root.id, role: "Chair", term: "2026", order: 0 },
          { groupId: child.id, role: "Advisor", term: "2026", order: 1 },
        ],
      };
      let row = await ok("/api/staff/governance", 0, {
        action: "save",
        version: 0,
        body,
      });
      ids.push(row.id);
      assert.equal(row.status, "unverified");
      assert.ok(!(await (await req("/governance")).text()).includes(label));
      assert.equal(
        (
          await req("/api/staff/governance", 0, {
            action: "publish",
            id: row.id,
            version: row.version,
            confirmPublication: true,
          })
        ).status,
        400,
      );
      row = await ok("/api/staff/governance", 0, {
        action: "submit",
        id: row.id,
        version: row.version,
      });
      let review = row.reviews[0];
      assert.equal(review.status, "pending");
      const proposalVersion = row.version;
      row = await ok("/api/staff/governance", 0, {
        action: "submit",
        id: row.id,
        version: row.version,
      });
      assert.equal(
        row.reviews.filter((r: { status: string }) => r.status === "pending")
          .length,
        1,
      );
      assert.ok(
        row.reviews.some((r: { status: string }) => r.status === "superseded"),
      );
      assert.equal(
        (
          await req("/api/staff/profile-reviews", 0, {
            action: "approve",
            id: row.id,
            version: proposalVersion,
            reviewId: review.id,
          })
        ).status,
        409,
      );
      review = row.reviews.find(
        (r: { status: string }) => r.status === "pending",
      );
      row = await ok("/api/staff/profile-reviews", 0, {
        action: "approve",
        id: row.id,
        version: row.version,
        reviewId: review.id,
      });
      assert.equal(row.status, "verified");
      assert.equal(row.published, null);
      const reviewerView = (await ok("/api/staff/governance?id=" + row.id, 4))
        .records[0];
      assert.equal(reviewerView.draft.phone, body.phone);
      assert.equal(
        (
          await req("/api/staff/profile-reviews", 4, {
            action: "approve",
            id: row.id,
            version: row.version,
            reviewId: review.id,
          })
        ).status,
        403,
      );
      row = await ok("/api/staff/governance", 2, {
        action: "publish",
        id: row.id,
        version: row.version,
        confirmPublication: true,
      });
      const html = await (await req("/governance")).text();
      assert.ok(html.includes(label));
      assert.ok(html.includes("Synthetic subgroup"));
      assert.ok(!html.includes(body.phone));
      assert.ok(!html.includes("private-profile"));
      const read = (await ok("/api/staff/governance?id=" + row.id, 2))
        .records[0];
      assert.equal(read.draft.phone, "");
      assert.ok(
        read.reviews.every(
          (r: { body: { phone: string } }) => r.body.phone === "",
        ),
      );
      row = await ok("/api/staff/governance", 2, {
        action: "save",
        id: row.id,
        version: row.version,
        body: {
          ...read.draft,
          name: label + " pending",
          phone: "+91 9999999999",
        },
      });
      assert.equal(row.draft.phone, "");
      assert.equal(
        (
          await pool.query(
            "SELECT draft->>'phone' AS phone FROM tpa.people WHERE id=$1",
            [row.id],
          )
        ).rows[0].phone,
        body.phone,
      );
      assert.ok(
        !(await (await req("/governance")).text()).includes(label + " pending"),
      );
      row = await ok("/api/staff/governance", 2, {
        action: "submit",
        id: row.id,
        version: row.version,
      });
      assert.equal(
        (
          await req("/api/staff/profile-reviews", 2, {
            action: "approve",
            id: row.id,
            version: row.version,
            reviewId: row.reviews[0].id,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await req("/api/staff/profile-reviews", 0, {
            action: "reject",
            id: row.id,
            version: row.version,
            reviewId: row.reviews[0].id,
            reason: "",
          })
        ).status,
        400,
      );
      row = await ok("/api/staff/profile-reviews", 0, {
        action: "reject",
        id: row.id,
        version: row.version,
        reviewId: row.reviews[0].id,
        reason: "Synthetic correction requested",
      });
      assert.equal(row.status, "rejected");
      assert.equal(row.accepted.name, label);
      const owner = await ok("/api/member/profile", 3);
      const otherId = owner.person.id;
      ids.push(otherId);
      assert.equal(
        (
          await req("/api/member/profile", 3, {
            action: "save",
            version: owner.person.version,
            body: { name: "Invalid claim", assignments: body.assignments },
          })
        ).status,
        403,
      );
      let own = await ok("/api/member/profile", 3, {
        action: "save",
        id: row.id,
        version: owner.person.version,
        body: { name: "Synthetic owner", organization: "Proposed company" },
      });
      assert.equal(own.id, otherId);
      assert.equal((await ok("/api/member/profile", 3)).organization, "");
      own = await ok("/api/member/profile", 3, {
        action: "submit",
        version: own.version,
      });
      own = await ok("/api/staff/profile-reviews", 0, {
        action: "approve",
        id: own.id,
        version: own.version,
        reviewId: own.reviews[0].id,
      });
      assert.equal(
        (await ok("/api/member/profile", 3)).organization,
        "Proposed company",
      );
      await ok("/api/member/profile", 3, {
        action: "preferences",
        newsletter: false,
        contactPreference: "none",
      });
      assert.equal(
        (await ok("/api/member/profile", 3)).preferences.contact,
        "none",
      );
      assert.equal(
        (
          await req("/api/staff/profile-groups", 0, {
            action: "archive",
            id: child.id,
            version: child.version,
          })
        ).status,
        400,
      );
      row = await ok("/api/staff/governance", 0, {
        action: "unpublish",
        id: row.id,
        version: row.version,
      });
      assert.ok(!(await (await req("/governance")).text()).includes(label));
      assert.ok(row.history.length >= 8);
      assert.equal(
        (await req("/api/profile-portraits?personId=" + row.id, 3)).status,
        403,
      );
      assert.equal(
        (await req("/api/profile-portraits/" + randomUUID())).status,
        404,
      );
    } finally {
      await pool.query(
        "DELETE FROM tpa.people WHERE id=ANY($1::uuid[]) OR user_id=ANY($2::text[])",
        [ids, users],
      );
      await pool.query(
        "DELETE FROM tpa.profile_groups WHERE id=ANY($1::uuid[]) AND parent_id IS NOT NULL",
        [groups],
      );
      await pool.query(
        "DELETE FROM tpa.profile_groups WHERE id=ANY($1::uuid[])",
        [groups],
      );
      await pool.query(
        "DELETE FROM tpa.audit_events WHERE actor_user_id=ANY($1::text[])",
        [users],
      );
      await pool.query(
        "DELETE FROM tpa.newsletter_consents WHERE user_id=ANY($1::text[])",
        [users],
      );
      await pool.query(
        "DELETE FROM tpa.member_profiles WHERE user_id=ANY($1::text[])",
        [users],
      );
      await pool.query('DELETE FROM public."user" WHERE id=ANY($1::text[])', [
        users,
      ]);
      await pool.end();
    }
  },
);
