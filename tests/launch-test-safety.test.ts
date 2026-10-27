import test from "node:test";
import assert from "node:assert/strict";
import { assertQaRoot, blankDotenvKeys, syntheticEnvironment } from "../scripts/launch-test-safety.mjs";

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
