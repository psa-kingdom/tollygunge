import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
const base = process.env.TPA_TEST_URL;
test(
  "campaign drafts preserve revisions, respect live consent and cannot dispatch",
  {
    skip: !base || !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET,
  },
  async () => {
    const pool = new Pool(databaseOptions()),
      people = Array.from({ length: 6 }, () => randomUUID()),
      cookies: string[] = [],
      city = `CampaignFixture-${randomUUID()}`;
    let campaignId: string | undefined;
    const request = (
      path: string,
      person?: number,
      body?: object,
      origin = base!,
    ) =>
      fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          ...(person === undefined ? {} : { cookie: cookies[person] }),
          ...(body ? { "content-type": "application/json", origin } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    try {
      for (let index = 0; index < people.length; index++) {
        const id = people[index],
          token = randomBytes(32).toString("hex");
        await pool.query(
          'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,$4)',
          [id, "Campaign fixture", id + "@example.invalid", index !== 3],
        );
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
        if (index >= 1 && index <= 4) {
          await pool.query(
            "INSERT INTO tpa.member_profiles(user_id,city,profession,preferences) VALUES($1,$2,'Accounting',$3)",
            [id, city, { contact: index === 4 ? "none" : "email" }],
          );
          await pool.query(
            "INSERT INTO tpa.newsletter_consents(user_id,subscribed,source) VALUES($1,$2,'synthetic_campaign_test')",
            [id, index !== 2],
          );
        }
      }
      await pool.query(
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'communications_operator'),($2,'content_editor')",
        [people[0], people[5]],
      );
      assert.equal((await request("/api/staff/campaigns")).status, 401);
      assert.equal((await request("/api/staff/campaigns", 1)).status, 403);
      assert.equal((await request("/api/staff/campaigns", 5)).status, 403);
      const audience = { city: city.toLowerCase(), profession: "accounting" };
      const previewBody = { action: "preview", audience };
      assert.equal(
        (
          await request(
            "/api/staff/campaigns",
            0,
            previewBody,
            "https://example.invalid",
          )
        ).status,
        403,
      );
      const preview = await (
        await request("/api/staff/campaigns", 0, previewBody)
      ).json();
      assert.equal(preview.matched, 4);
      assert.equal(preview.eligible, 1);
      assert.equal(preview.unsubscribed, 1);
      assert.equal(preview.unverified, 1);
      assert.equal(preview.preference_blocked, 1);
      assert.deepEqual(
        preview.sample.map((person: { email: string }) => person.email),
        [people[1] + "@example.invalid"],
      );
      assert.equal(preview.deliveryEnabled, false);
      await pool.query(
        "UPDATE tpa.newsletter_consents SET subscribed=false WHERE user_id=$1",
        [people[1]],
      );
      assert.equal(
        (await (await request("/api/staff/campaigns", 0, previewBody)).json())
          .eligible,
        0,
      );
      await pool.query(
        "UPDATE tpa.newsletter_consents SET subscribed=true WHERE user_id=$1",
        [people[1]],
      );
      await pool.query(
        'UPDATE tpa.member_profiles SET preferences=\'{"contact":"none"}\' WHERE user_id=$1',
        [people[1]],
      );
      const preferences = await (
        await request("/api/staff/campaigns", 0, previewBody)
      ).json();
      assert.equal(preferences.eligible, 0);
      assert.equal(preferences.preference_blocked, 2);
      const details = {
        action: "save",
        version: 0,
        name: "Synthetic campaign",
        subject: "Synthetic newsletter",
        body: "This is a synthetic draft and will never be delivered.",
        audience,
        status: "sent",
      };
      const response = await request("/api/staff/campaigns", 0, details);
      assert.equal(response.status, 200);
      const saved = await response.json();
      campaignId = saved.id;
      assert.equal(saved.status, "draft");
      assert.equal(saved.version, 1);
      const races = await Promise.all(
        ["A", "B"].map((suffix) =>
          request("/api/staff/campaigns", 0, {
            ...details,
            id: campaignId,
            version: 1,
            subject: "Synthetic " + suffix,
          }),
        ),
      );
      assert.equal(races.filter((result) => result.status === 200).length, 1);
      assert.equal(races.filter((result) => result.status === 409).length, 1);
      const archive = await request("/api/staff/campaigns", 0, {
        action: "archive",
        id: campaignId,
        version: 2,
      });
      assert.equal(archive.status, 200);
      assert.equal((await archive.json()).status, "archived");
      assert.equal(
        (
          await request("/api/staff/campaigns", 0, {
            ...details,
            id: campaignId,
            version: 3,
          })
        ).status,
        409,
      );
      const archived = await (
        await request("/api/staff/campaigns?status=archived", 0)
      ).json();
      assert.ok(
        archived.campaigns.some(
          (entry: { id: string }) => entry.id === campaignId,
        ),
      );
      assert.equal(
        (
          await request("/api/staff/campaigns", 0, {
            action: "restore",
            id: campaignId,
            version: 3,
          })
        ).status,
        200,
      );
      const history = await (
        await request("/api/staff/campaigns?id=" + campaignId, 0)
      ).json();
      assert.deepEqual(
        history.revisions.map(
          (revision: { version: number }) => revision.version,
        ),
        [4, 3, 2, 1],
      );
      assert.equal(history.revisions[3].snapshot.subject, details.subject);
      assert.equal(history.revisions[1].snapshot.status, "archived");
      for (const action of ["send", "schedule", "enqueue"])
        assert.equal(
          (
            await request("/api/staff/campaigns", 0, {
              action,
              id: campaignId,
              version: 4,
            })
          ).status,
          409,
        );
      assert.equal(
        (
          await request("/api/staff/campaigns", 0, {
            ...details,
            subject: "Header\nBcc: test",
          })
        ).status,
        400,
      );
      await pool.query("DELETE FROM tpa.staff_roles WHERE user_id=$1", [
        people[0],
      ]);
      assert.equal(
        (await request("/api/staff/campaigns?id=" + campaignId, 0)).status,
        403,
      );
    } finally {
      if (campaignId)
        await pool.query("DELETE FROM tpa.campaign_drafts WHERE id=$1", [
          campaignId,
        ]);
      for (const id of people) {
        await pool.query(
          "DELETE FROM tpa.newsletter_consents WHERE user_id=$1",
          [id],
        );
        await pool.query("DELETE FROM tpa.member_profiles WHERE user_id=$1", [
          id,
        ]);
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
