// Remove only this workstream's identified rehearsal objects and databases.
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { databaseOptions } from "../src/lib/database-options";
import { managedStorageCredentials } from "../src/domain/storage-configuration";
import { parseR2Credentials } from "../src/domain/r2-credentials";
import { portraitObjectKey } from "../src/domain/portrait-storage";
assert.equal(process.env.TPA_DATABASE_NAME, "railway");
const folder = ".local/real-data/";
const rehearsal = JSON.parse(
  await readFile(folder + "rehearsal-content-results.json", "utf8"),
);
const backup = JSON.parse(
  await readFile(folder + "backup-verification.json", "utf8"),
);
const ids = rehearsal.people.map(
  (person: { portraitId: string }) => person.portraitId,
);
assert.equal(ids.length, 8);
assert.equal(new Set(ids).size, 8);
const pool = new Pool(databaseOptions());
try {
  assert.equal(
    (await pool.query("SELECT current_database() n")).rows[0].n,
    "railway",
  );
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM tpa.profile_portraits WHERE id=ANY($1::uuid[])",
        [ids],
      )
    ).rowCount,
    0,
    "Rehearsal portrait used in production",
  );
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM tpa.people WHERE accepted->>'portraitId'=ANY($1::text[]) OR published->>'portraitId'=ANY($1::text[])",
        [ids],
      )
    ).rowCount,
    0,
  );
  const credentials =
    managedStorageCredentials(process.env) ??
    parseR2Credentials(
      await readFile(process.env.CLOUDFLARE_CREDENTIAL_FILE!, "utf8"),
    );
  assert.equal(process.env.R2_BUCKET_NAME, "tpa-private-documents");
  const storage = new S3Client({
    region: "auto",
    endpoint: `https://${credentials.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
  for (const id of ids) {
    const object = {
      Bucket: "tpa-private-documents",
      Key: portraitObjectKey(id),
    };
    await storage.send(new DeleteObjectCommand(object));
    let absent = false;
    try {
      await storage.send(new HeadObjectCommand(object));
    } catch (error) {
      absent =
        (error as { $metadata?: { httpStatusCode: number } }).$metadata
          ?.httpStatusCode === 404;
    }
    assert.ok(absent, "Identified rehearsal object was not removed");
  }
  const databases = [
    "tpa_onboarding_test_realdata_20261011",
    "tpa_onboarding_test_backup_1791660258575",
    "tpa_onboarding_test_backup_1791662216566",
    "tpa_onboarding_test_backup_1791662858773",
  ];
  const removed: string[] = [];
  for (const name of databases) {
    assert.notEqual(name, backup.db);
    if (
      !(await pool.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
        .rowCount
    )
      continue;
    assert.equal(
      (
        await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=$1", [
          name,
        ])
      ).rowCount,
      0,
      "Rehearsal database still in use",
    );
    await pool.query(`DROP DATABASE ${name}`);
    removed.push(name);
  }
  const report = {
    rehearsalPortraitsRemoved: ids.length,
    removedDatabases: removed,
    retainedRecoveryDatabase: backup.db,
    productionRecordsRemoved: 0,
    originalFilesPreserved: true,
  };
  await writeFile(
    folder + "cleanup-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await pool.end();
}
