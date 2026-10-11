import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
const report = JSON.parse(
  await readFile(".local/real-data/rehearsal-member-results.json", "utf8"),
);
const ids = report.results
  .filter((r: { status: string }) => r.status === "created")
  .map((r: { personId: string }) => r.personId);
assert.ok(ids.length > 0);
const db = new Pool(databaseOptions()),
  c = await db.connect();
try {
  const actual = (await c.query("SELECT current_database() n")).rows[0].n;
  assert.equal(actual, process.env.TPA_DATABASE_NAME);
  assert.equal(actual, report.database);
  assert.ok(actual.startsWith("tpa_onboarding_test_"));
  await c.query("BEGIN");
  const cohort = (
    await c.query(
      "SELECT p.id,p.user_id,p.published,m.source FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id WHERE p.id=ANY($1::uuid[]) FOR UPDATE",
      [ids],
    )
  ).rows;
  assert.equal(cohort.length, ids.length);
  assert.ok(
    cohort.every(
      (p) =>
        p.user_id === null && p.published === null && p.source === "import",
    ),
  );
  await writeFile(
    ".local/real-data/rehearsal-member-results-before-name-fix.json",
    JSON.stringify(
      {
        ...report,
        superseded: true,
        supersededReason:
          "Repeat exact-source rehearsal after display-name prefix correction.",
      },
      null,
      2,
    ),
  );
  await c.query(
    "DELETE FROM tpa.audit_events WHERE entity_id::text=ANY($1::text[])",
    [ids],
  );
  await c.query("DELETE FROM tpa.memberships WHERE person_id=ANY($1::uuid[])", [
    ids,
  ]);
  assert.equal(
    (await c.query("DELETE FROM tpa.people WHERE id=ANY($1::uuid[])", [ids]))
      .rowCount,
    ids.length,
  );
  await c.query("COMMIT");
  console.log(
    JSON.stringify({
      isolatedImportedFixturesRemoved: ids.length,
      priorEvidencePreserved: true,
    }),
  );
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  c.release();
  await db.end();
}
