import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
test(
  "editorial publication preserves private information and never grants professional verification",
  { skip: !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_") },
  async () => {
    const db = new Pool(databaseOptions()),
      base = process.env.TPA_TEST_URL!,
      cookie = readFileSync(
        ".local/real-data/rehearsal-cookie.txt",
        "utf8",
      ).trim(),
      ids: string[] = [];
    assert.equal(
      (await db.query("SELECT current_database() n")).rows[0].n,
      process.env.TPA_DATABASE_NAME,
    );
    async function req(path: string, body: object, authenticated = true) {
      return fetch(base + path, {
        method: "POST",
        headers: {
          origin: base,
          "content-type": "application/json",
          ...(authenticated ? { cookie } : {}),
        },
        body: JSON.stringify(body),
      });
    }
    async function ok(path: string, body: object) {
      const r = await req(path, body);
      assert.equal(r.status, 200, await r.clone().text());
      return r.json();
    }
    try {
      const group = (
        await (
          await fetch(base + "/api/staff/governance", { headers: { cookie } })
        ).json()
      ).groups.find(
        (g: { draft: { name: string } }) =>
          g.draft.name === "Executive Committee",
      );
      let p = await ok("/api/staff/governance", {
        action: "save",
        version: 0,
        body: { name: "Editorial fixture " + randomUUID() },
      });
      ids.push(p.id);
      const original = (
        await db.query(
          "SELECT accepted,contact_email,accepted_verified FROM tpa.people WHERE id=$1",
          [p.id],
        )
      ).rows[0];
      p = await ok("/api/staff/governance", {
        action: "save",
        id: p.id,
        version: p.version,
        body: {
          ...p.accepted,
          biography: "Supplied editorial biography.",
          assignments: [
            { groupId: group.id, role: "Fixture", term: "", order: 99 },
          ],
        },
      });
      p = await ok("/api/staff/governance", {
        action: "submit",
        id: p.id,
        version: p.version,
      });
      const review = p.reviews.find(
        (r: { status: string }) => r.status === "pending",
      );
      const approval = {
        action: "approve_editorial",
        id: p.id,
        version: p.version,
        reviewId: review.id,
        reason: "Synthetic editorial authorization test.",
      };
      assert.equal(
        (await req("/api/staff/profile-reviews", approval, false)).status,
        401,
      );
      assert.equal(
        (
          await req("/api/staff/profile-reviews", {
            ...approval,
            version: p.version - 1,
          })
        ).status,
        409,
      );
      p = await ok("/api/staff/profile-reviews", approval);
      p = await ok("/api/staff/governance", {
        action: "publish",
        id: p.id,
        version: p.version,
        confirmPublication: true,
      });
      const row = (
        await db.query("SELECT * FROM tpa.people WHERE id=$1", [p.id])
      ).rows[0];
      assert.equal(row.accepted_verified, false);
      assert.equal(row.published.verified, false);
      assert.equal(row.contact_email, original.contact_email);
      assert.equal(row.status, "unverified");
      assert.equal(row.published.email, undefined);
      assert.equal(row.published.phone, "");
      p = await ok("/api/staff/governance", {
        action: "save",
        id: p.id,
        version: p.version,
        body: {
          ...p.accepted,
          organization: "Different private/member information",
        },
      });
      assert.equal(
        (
          await req("/api/staff/governance", {
            action: "publish",
            id: p.id,
            version: p.version,
            confirmPublication: true,
          })
        ).status,
        400,
      );
      p = await ok("/api/staff/governance", {
        action: "submit",
        id: p.id,
        version: p.version,
      });
      const changed = p.reviews.find(
        (r: { status: string }) => r.status === "pending",
      );
      assert.equal(
        (
          await req("/api/staff/profile-reviews", {
            action: "approve_editorial",
            id: p.id,
            version: p.version,
            reviewId: changed.id,
            reason: "Must reject member changes.",
          })
        ).status,
        400,
      );
      assert.deepEqual(
        (await db.query("SELECT accepted FROM tpa.people WHERE id=$1", [p.id]))
          .rows[0].accepted,
        row.accepted,
      );
    } finally {
      for (const id of ids) {
        await db.query("DELETE FROM tpa.audit_events WHERE entity_id=$1", [id]);
        await db.query("DELETE FROM tpa.people WHERE id=$1", [id]);
      }
      await db.end();
    }
  },
);
