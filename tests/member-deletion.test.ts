import test from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { deleteMember, releasePreviouslyDeletedEmail, resolveArchivedMember } from "../src/lib/member-deletion";

function database(row?: Record<string, unknown>, replies: Record<string, unknown>[][] = []) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client = {
    async query(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      const rows = calls.length === 1 && row ? [row] : (replies[calls.length - 2] ?? []);
      return { rows, rowCount: rows.length };
    },
  } as unknown as Pick<PoolClient, "query">;
  return { client, calls };
}

test("member deletion archives the profile, records history and preserves linked data", async () => {
  const db = database({ person_version: 3, membership_version: 2, archived_at: null });
  assert.deepEqual(await deleteMember(db.client, "admin", "person", 3, 2), {
    deleted: true, recoverable: true,
  });
  assert.match(db.calls[0].sql, /FOR UPDATE OF p,m/);
  assert.match(db.calls[1].sql, /archived_at=now\(\),published=NULL,version=version\+1/);
  assert.match(db.calls[2].sql, /tpa.person_revisions/);
  assert.equal(db.calls[3].values[1], "member.deleted");
  assert.ok(db.calls.every(({ sql }) => !/\bDELETE\b|UPDATE public\.|UPDATE tpa\.memberships/i.test(sql)));
});

for (const [name, row, expectedStatus] of [
  ["missing member", undefined, 404],
  ["stale profile", { person_version: 4, membership_version: 2 }, 409],
  ["stale membership", { person_version: 3, membership_version: 4 }, 409],
  ["already archived member", { person_version: 3, membership_version: 2, archived_at: new Date() }, 409],
] as const) {
  test(`member deletion rejects ${name} without writing`, async () => {
    const db = database(row);
    await assert.rejects(deleteMember(db.client, "admin", "person", 3, 2),
      (error: unknown) => (error as { status: number }).status === expectedStatus);
    assert.equal(db.calls.length, 1);
  });
}

test("final deletion releases an ordinary member email while retaining historical references", async () => {
  const db = database({ version: 3, archived_at: new Date(), user_id: "member" }, [
    [{ version: 2 }], [{ email: "member@example.org" }], [],
  ]);
  await resolveArchivedMember(db.client, "admin", "person", 3, 2, "delete-archived");
  const loginUpdate = db.calls.find(({ sql }) => sql.includes('UPDATE public."user"'));
  assert.match(String(loginUpdate?.values[1]), /^deleted-.+@accounts\.invalid$/);
  assert.ok(db.calls.some(({ sql }) => sql.includes('DELETE FROM public."session"')));
  assert.ok(db.calls.some(({ sql }) => sql.includes('DELETE FROM public."account"')));
  assert.ok(db.calls.some(({ sql }) => sql.includes("contact_email=CASE")));
  assert.ok(!db.calls.some(({ sql }) => /DELETE FROM (tpa\.memberships|public\."user")/.test(sql)));
});

test("previous deletion cannot release a staff email, but the archive record can be restored", async () => {
  const candidate = { id: "person", user_id: "staff", matches_login: true };
  const blocked = database(candidate, [[{ email: "staff@example.org" }], [{}]]);
  await assert.rejects(
    releasePreviouslyDeletedEmail(blocked.client, "admin", "staff@example.org"),
    { code: "staff_account_retained" },
  );
  assert.equal(blocked.calls.length, 3);

  const archived = database({
    version: 3, archived_at: new Date(), directory_deleted_at: new Date(), user_id: "staff", protected_account: true,
  }, [[{ version: 2 }]]);
  await resolveArchivedMember(archived.client, "admin", "person", 3, 2, "restore");
  assert.deepEqual(archived.calls[2].values, ["person", true]);
  assert.ok(archived.calls.every(({ sql }) => !sql.includes('UPDATE public."user"')));
});
