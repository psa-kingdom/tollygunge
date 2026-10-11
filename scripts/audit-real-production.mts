// Independent read-only reconciliation against the restored pre-rollout snapshot.
import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
const folder = ".local/real-data/";
const backup = JSON.parse(
  await readFile(folder + "backup-verification.json", "utf8"),
);
const content = JSON.parse(
  await readFile(folder + "production-content-results.json", "utf8"),
);
const members = JSON.parse(
  await readFile(folder + "production-member-results.json", "utf8"),
);
const rehearsal = JSON.parse(
  await readFile(folder + "rehearsal-member-results.json", "utf8"),
);
assert.equal(process.env.TPA_DATABASE_NAME, "railway");
assert.ok(
  backup.restored && /^tpa_onboarding_test_backup_\d+$/.test(backup.db),
);
const options = databaseOptions(),
  restoredUrl = new URL(options.connectionString!);
restoredUrl.pathname = "/" + backup.db;
const live = new Pool(options),
  previous = new Pool({ ...options, connectionString: restoredUrl.toString() });
type Person = {
  id: string;
  user_id: string | null;
  accepted: Record<string, unknown>;
  draft: Record<string, unknown>;
  published: Record<string, unknown> | null;
  accepted_verified: boolean;
};
const editorial = new Set([
  "biography",
  "biographyRich",
  "portraitId",
  "portraitKind",
  "assignments",
  "nameSize",
]);
const privateFields = (value: Record<string, unknown> | null) =>
  value &&
  Object.fromEntries(
    Object.entries(value).filter(([key]) => !editorial.has(key)),
  );
try {
  assert.equal(
    (await live.query("SELECT current_database() n")).rows[0].n,
    "railway",
  );
  const original = (
    await previous.query<Person>(
      "SELECT id,user_id,accepted,draft,published,accepted_verified FROM tpa.people ORDER BY id",
    )
  ).rows;
  const current = (
    await live.query<Person>(
      "SELECT id,user_id,accepted,draft,published,accepted_verified FROM tpa.people ORDER BY id",
    )
  ).rows;
  for (const person of original) {
    const now = current.find((row) => row.id === person.id);
    assert.ok(now, "Original person missing");
    assert.ok(
      now.user_id === person.user_id &&
        now.accepted_verified === person.accepted_verified,
      "Original identity or verification changed",
    );
    for (const field of ["accepted", "draft"] as const)
      assert.ok(
        isDeepStrictEqual(
          privateFields(now[field]),
          privateFields(person[field]),
        ),
        "Original private profile fields changed",
      );
    if (!content.people.some((row: { id: string }) => row.id === person.id))
      assert.ok(isDeepStrictEqual(now, person), "Unrelated person changed");
  }
  for (const query of [
    'SELECT id,name,email,"emailVerified" FROM public."user" ORDER BY id',
    'SELECT id,"userId","providerId","accountId",password FROM public."account" ORDER BY id',
  ]) {
    assert.ok(
      isDeepStrictEqual(
        (await live.query(query)).rows,
        (await previous.query(query)).rows,
      ),
      "Original account identity or credentials changed",
    );
  }
  const created = content.people.filter(
    (row: { created: boolean }) => row.created,
  );
  assert.equal(current.length, original.length + created.length);
  assert.equal(content.people.length, 8);
  for (const row of created)
    assert.equal(
      current.find((person) => person.id === row.id)?.accepted_verified,
      false,
    );
  assert.equal(members.sourceHash, rehearsal.sourceHash);
  assert.equal(members.preview.rows.length, 211);
  for (let index = 0; index < 211; index++) {
    const actual = members.preview.rows[index],
      expected = rehearsal.preview.rows[index];
    assert.ok(
      isDeepStrictEqual(actual.member, expected.member),
      "Source field differs from exact rehearsal",
    );
    assert.equal(actual.sourceRow, expected.sourceRow);
    assert.equal(actual.status, expected.status);
  }
  assert.deepEqual(members.totals, {
    created: 0,
    updated: 0,
    skipped: 0,
    conflict: 134,
    failed: 77,
  });
  const report = {
    originalPeoplePreserved: original.length,
    originalAccountsAndCredentialsPreserved: true,
    newEditorialPeople: created.length,
    newProfessionalVerification: false,
    allSourceRowsCompared: 211,
    sourceSamples: [
      members.preview.rows[0].sourceRow,
      members.preview.rows[105].sourceRow,
      members.preview.rows[210].sourceRow,
    ],
    memberTotals: members.totals,
  };
  await writeFile(
    folder + "production-independent-audit.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await live.end();
  await previous.end();
}
