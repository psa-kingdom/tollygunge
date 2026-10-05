import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
const base = process.env.TPA_TEST_URL;
test(
  "association profiles require publication and preserve draft, portrait and role boundaries",
  {
    skip: !base || !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET,
  },
  async () => {
    const pool = new Pool(databaseOptions()),
      people = [randomUUID(), randomUUID()],
      cookies: string[] = [],
      ids: string[] = [],
      asset = randomUUID(),
      privateId = randomUUID(),
      label = `Synthetic governance ${randomUUID()}`;
    const req = (path: string, person?: number, body?: object) =>
      fetch(base + path, {
        method: body ? "POST" : "GET",
        redirect: "manual",
        headers: {
          ...(person !== undefined ? { cookie: cookies[person] } : {}),
          ...(body
            ? { origin: base!, "content-type": "application/json" }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    try {
      for (const id of people) {
        await pool.query(
          'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Governance fixture\',$2,true)',
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
        "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'content_editor'),($2,'finance_operator')",
        people,
      );
      await pool.query(
        "INSERT INTO tpa.private_documents(id,owner_user_id,kind,content_type,byte_size) VALUES($1,$2,'certificate','application/pdf',100)",
        [privateId, people[0]],
      );
      const media = {
        title: "Synthetic portrait metadata only",
        altText: "Synthetic portrait",
        category: "Portrait",
      };
      await pool.query(
        "INSERT INTO tpa.public_media(id,title,alt_text,category,draft,content_type,byte_size,width,height,uploaded_by) VALUES($1,$2,$3,'Portrait',$4,'image/webp',100,88,88,$5)",
        [asset, media.title, media.altText, media, people[0]],
      );
      assert.equal((await req("/api/staff/governance")).status, 401);
      assert.equal((await req("/api/staff/governance", 1)).status, 403);
      const body = {
        name: label,
        role: "Synthetic Chair",
        group: "executive",
        committee: "",
        profession: "Synthetic profession",
        biography: "Synthetic biography for verification only.",
        term: "Synthetic term",
        order: 5,
        portraitId: null,
      };
      for (const portraitId of [asset, privateId, randomUUID()])
        assert.equal(
          (
            await req("/api/staff/governance", 0, {
              action: "save",
              version: 0,
              body: { ...body, portraitId },
            })
          ).status,
          400,
        );
      const saved = await req("/api/staff/governance", 0, {
        action: "save",
        version: 0,
        body,
      });
      assert.equal(saved.status, 200);
      let row = await saved.json();
      ids.push(row.id);
      assert.ok(!(await (await req("/governance")).text()).includes(label));
      assert.equal(
        (
          await req("/api/staff/governance", 0, {
            action: "publish",
            id: row.id,
            version: row.version,
          })
        ).status,
        400,
      );
      const published = await req("/api/staff/governance", 0, {
        action: "publish",
        id: row.id,
        version: row.version,
        confirmPublication: true,
      });
      assert.equal(published.status, 200);
      row = await published.json();
      assert.ok((await (await req("/governance")).text()).includes(label));
      const oldVersion = row.version;
      const edited = await req("/api/staff/governance", 0, {
        action: "save",
        id: row.id,
        version: row.version,
        body: { ...body, name: label + " draft edit", group: "founding" },
      });
      assert.equal(edited.status, 200);
      row = await edited.json();
      const live = await (await req("/governance")).text();
      assert.ok(live.includes(label));
      assert.ok(!live.includes(label + " draft edit"));
      assert.ok(
        !(await (await req("/about")).text()).includes(label + " draft edit"),
      );
      assert.equal(
        (
          await req("/api/staff/governance", 0, {
            action: "publish",
            id: row.id,
            version: oldVersion,
            confirmPublication: true,
          })
        ).status,
        409,
      );
      const republish = await req("/api/staff/governance", 0, {
        action: "publish",
        id: row.id,
        version: row.version,
        confirmPublication: true,
      });
      assert.equal(republish.status, 200);
      row = await republish.json();
      assert.ok(
        (await (await req("/about")).text()).includes(label + " draft edit"),
      );
      assert.ok(!(await (await req("/governance")).text()).includes(label));
      await pool.query("UPDATE tpa.public_media SET published=$2 WHERE id=$1", [
        asset,
        media,
      ]);
      const withPortrait = await req("/api/staff/governance", 0, {
        action: "save",
        id: row.id,
        version: row.version,
        body: { ...body, group: "founding", portraitId: asset },
      });
      assert.equal(withPortrait.status, 200);
      row = await withPortrait.json();
      const portraitPublication = await req("/api/staff/governance", 0, {
        action: "publish",
        id: row.id,
        version: row.version,
        confirmPublication: true,
      });
      assert.equal(portraitPublication.status, 200);
      row = await portraitPublication.json();
      assert.ok(
        (await (await req("/about")).text()).includes(`/media/${asset}`),
      );
      await pool.query(
        "UPDATE tpa.public_media SET published=NULL WHERE id=$1",
        [asset],
      );
      assert.ok(
        !(await (await req("/about")).text()).includes(`/media/${asset}`),
      );
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
      assert.equal(
        (
          await req("/api/staff/governance", 0, {
            action: "unpublish",
            id: row.id,
            version: row.version,
          })
        ).status,
        200,
      );
      assert.ok(!(await (await req("/about")).text()).includes(label));
      const history = (
        await (await req("/api/staff/governance", 0)).json()
      ).records.find((r: { id: string }) => r.id === row.id).history;
      assert.equal(history.length, 7);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM tpa.staff_roles WHERE user_id=$1",
            [people[0]],
          )
        ).rows[0].n,
        1,
      );
    } finally {
      await pool.query(
        "DELETE FROM tpa.governance_revisions WHERE profile_id=ANY($1::uuid[])",
        [ids],
      );
      await pool.query(
        "DELETE FROM tpa.governance_profiles WHERE id=ANY($1::uuid[])",
        [ids],
      );
      await pool.query("DELETE FROM tpa.public_media WHERE id=$1", [asset]);
      await pool.query("DELETE FROM tpa.private_documents WHERE id=$1", [
        privateId,
      ]);
      await pool.query(
        "DELETE FROM tpa.audit_events WHERE entity_id=ANY($1::text[]) OR actor_user_id=ANY($2::text[])",
        [ids, people],
      );
      await pool.query(
        "DELETE FROM tpa.staff_roles WHERE user_id=ANY($1::text[])",
        [people],
      );
      await pool.query(
        'DELETE FROM public."session" WHERE "userId"=ANY($1::text[])',
        [people],
      );
      await pool.query('DELETE FROM public."user" WHERE id=ANY($1::text[])', [
        people,
      ]);
      await pool.end();
    }
  },
);
