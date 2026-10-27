import test from "node:test";
import assert from "node:assert/strict";
import { assertQaRoot, blankDotenvKeys, syntheticEnvironment, parseTestSummaries, buildInputIdentity, validateBuildIdentity } from "../scripts/launch-test-safety.mjs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";

test("launch QA refuses hosted databases, alternate identities and connection overrides", () => {
  const good = "postgresql://tpa_qa:synthetic@127.0.0.1:55439/postgres";
  assert.equal(assertQaRoot(good).pathname, "/postgres");
  for (const bad of [undefined, "", good.replace("127.0.0.1", "db.example.com"), good.replace("55439", "5432"), good.replace("/postgres", "/tpa_production"), good.replace("tpa_qa:", "operator:"), good + "?host=production", good + "#override", good.replace("postgresql:", "https:")]) assert.throws(() => assertQaRoot(bad));
});

test("synthetic environment excludes inherited provider and runtime injection credentials", async () => {
  const env = await syntheticEnvironment({ PATH: "safe-path", DATABASE_URL: "hosted-secret", RESEND_API_KEY: "secret", TPA_EMAIL_DATABASE_URL: "secret", NODE_OPTIONS: "--import=unsafe", PGOPTIONS: "unsafe", BETTER_AUTH_SECRET: "secret", TPA_TEST_URL: "https://production", CI: "true" });
  for (const key of ["RESEND_API_KEY", "TPA_EMAIL_DATABASE_URL", "NODE_OPTIONS", "PGOPTIONS", "TPA_TEST_URL"]) assert.ok(!env[key]);
  assert.equal(env.PATH, "safe-path");
  assert.equal(env.TPA_MAIL_SINK, "true");
  assert.equal(env.EMAIL_OPERATIONS_ENABLED, "false");
  assert.equal(env.MEMBER_IMPORT_WORKER_ENABLED, "false");
  assert.ok(env.DATABASE_URL, "Synthetic environment always supplies its validated QA database URL");
  assert.match(env.DATABASE_URL, /127\.0\.0\.1:55439\/postgres$/);
  assert.notEqual(env.BETTER_AUTH_SECRET, "secret");
  await assert.rejects(() => syntheticEnvironment({}, process.cwd(), "postgresql://operator@remote.example.com/production"));
});

test("dotenv cannot restore provider settings or override deliberate synthetic values", () => {
  const env: Record<string, string> = { TPA_MAIL_SINK: "true" };
  blankDotenvKeys(env, "export RESEND_API_KEY=never-print\nTPA_MAIL_SINK=false\n SMTP_PASSWORD = hidden\n# COMMENT=value");
  assert.equal(env.RESEND_API_KEY, "");
  assert.equal(env.SMTP_PASSWORD, "");
  assert.equal(env.TPA_MAIL_SINK, "true");
  assert.equal(env.COMMENT, undefined);
});

test("summary extraction keeps nested node tests and browser skips in separate dimensions", () => {
  const counts = parseTestSummaries("# tests 4\n# pass 3\n# fail 0\n# skipped 1\n# cancelled 0\nℹ tests 2\nℹ pass 1\nℹ fail 0\nℹ skipped 1\nℹ cancelled 0\n  8 passed (2m)\n  36 skipped\n  1 failed\n");
  assert.deepEqual(counts.node, { tests: 6, passed: 4, failed: 0, skipped: 2, cancelled: 0, summaries: 2 });
  assert.deepEqual(counts.playwright, { passed: 8, failed: 1, skipped: 36, flaky: 0, interrupted: 0, notRun: 0, summaryLines: 3 });
});

test("missing summaries remain unknown and browser ANSI/flaky outcomes never become passes", () => {
  assert.deepEqual(parseTestSummaries("PASS scoped role check\n{\"code\":0}\n"), { node: null, playwright: null });
  const counts = parseTestSummaries("\u001b[32m  2 passed (1s)\u001b[39m\n  1 flaky\n  2 interrupted\n  3 did not run\n");
  assert.equal(counts.node, null);
  assert.deepEqual(counts.playwright, { passed: 2, failed: 0, skipped: 0, flaky: 1, interrupted: 2, notRun: 3, summaryLines: 4 });
});

test("build identity blocks missing/stale source or build IDs while allowing docs and test-only updates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tpa-build-identity-"));
  try {
    await mkdir(join(directory, "src"));
    await mkdir(join(directory, ".next"));
    await mkdir(join(directory, ".local/launch-readiness"), { recursive: true });
    await writeFile(join(directory, "src/page.ts"), "original source");
    await writeFile(join(directory, ".next/BUILD_ID"), "build-one");
    assert.equal((await validateBuildIdentity(directory)).valid, false, "A present BUILD_ID alone cannot certify its source");
    const inputs = await buildInputIdentity(directory);
    await writeFile(join(directory, ".local/launch-readiness/build-identity.json"), JSON.stringify({ schemaVersion: 1, status: "READY", buildId: "build-one", inputDigest: inputs.inputDigest }));
    assert.equal((await validateBuildIdentity(directory)).valid, true);
    await mkdir(join(directory, "docs"));
    await mkdir(join(directory, "tests"));
    await mkdir(join(directory, "scripts"));
    await writeFile(join(directory, "docs/report.md"), "new evidence");
    await writeFile(join(directory, "tests/regression.test.ts"), "new fixture");
    await writeFile(join(directory, "scripts/verify-example.mjs"), "QA-only script");
    assert.equal((await validateBuildIdentity(directory)).valid, true, "Evidence and test-only changes do not alter the app build");
    await writeFile(join(directory, "src/page.ts"), "changed source");
    assert.equal((await validateBuildIdentity(directory)).valid, false);
    await writeFile(join(directory, "src/page.ts"), "original source");
    await writeFile(join(directory, ".next/BUILD_ID"), "different-build");
    assert.equal((await validateBuildIdentity(directory)).valid, false);
    await writeFile(join(directory, ".next/BUILD_ID"), "build-one");
    await writeFile(join(directory, "scripts/email-worker.mts"), "changed worker");
    assert.equal((await validateBuildIdentity(directory)).valid, false, "Worker entrypoints are build inputs");
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("tpa-build-identity-"));
    await rm(directory, { recursive: true, force: true });
  }
});
