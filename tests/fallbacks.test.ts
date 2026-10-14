import test from "node:test";
import assert from "node:assert/strict";
import { fallbacks } from "../src/domain/fallbacks";
import { workerFailureCategory } from "../src/domain/worker-diagnostics";
test("fallback recovery links are local and never submit writes", () => {
  for (const content of Object.values(fallbacks)) {
    assert.match(content.action.href, /^\/(?!\/)/);
    assert.ok(content.title && content.description);
    assert.ok(!content.action.href.startsWith("/api/"));
  }
});
test("worker diagnostics classify failures without disclosing sensitive content", () => {
  assert.equal(workerFailureCategory({ code: "42P01", message: "private SQL" }), "database_schema");
  assert.equal(workerFailureCategory({ code: "ECONNREFUSED", message: "private URL" }), "database_connection");
  assert.equal(workerFailureCategory({ code: "28P01" }), "database_authentication");
  assert.equal(workerFailureCategory({ name: "EmailProviderError" }), "email_provider");
  assert.equal(workerFailureCategory({ code: "secret", message: "password" }), "unexpected_failure");
});
