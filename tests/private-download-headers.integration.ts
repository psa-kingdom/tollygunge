import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.TPA_PRIVATE_HEADER_TEST_URL;

test("private document responses retain their referrer protection alongside shared security headers", { skip: !base }, async () => {
  const url = new URL(base!);
  assert.equal(url.protocol, "http:");
  assert.equal(url.hostname, "127.0.0.1", "This regression must never target a hosted environment");
  const response = await fetch(new URL("/api/documents/00000000-0000-4000-8000-000000000001", url), { redirect: "manual" });
  assert.equal(response.status, 401, "The fixture is anonymous and must remain unauthorized");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000");
  const publicResponse = await fetch(new URL("/api/health", url));
  assert.equal(publicResponse.headers.get("referrer-policy"), "strict-origin-when-cross-origin", "Public response policy remains unchanged");
});

test("token-link and event-resource responses preserve their intended no-referrer policy", { skip: !base }, async () => {
  const url = new URL(base!);
  assert.equal(url.protocol, "http:");
  assert.equal(url.hostname, "127.0.0.1");
  const authConfigured = Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_URL && process.env.BETTER_AUTH_SECRET);
  for (const [path, status] of [
    ["/api/email/unsubscribe?token=" + "Q".repeat(43), 303],
    ["/api/event-assets/not-an-id", 404],
    ["/api/auth/verify-email?token=synthetic-invalid-token&callbackURL=%2Fmember", authConfigured ? 303 : 503],
    ["/api/auth/verify-email?token=synthetic-invalid-token", authConfigured ? 401 : 503],
    ["/api/newsletter/unsubscribe?token=" + "Q".repeat(43), 303],
  ] as const) {
    const response = await fetch(new URL(path, url), { redirect: "manual" });
    assert.equal(response.status, status, path.split("?")[0]);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer", path.split("?")[0]);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    if (authConfigured && path.includes("callbackURL="))
      assert.equal(response.headers.get("location"), "/email-verification");
    if (authConfigured && path === "/api/auth/verify-email?token=synthetic-invalid-token")
      assert.equal((await response.json()).code, "INVALID_TOKEN");
  }
  for (const path of ["/newsletter/confirm", "/newsletter/unsubscribe"]) {
    const response = await fetch(new URL(path, url), { redirect: "manual" });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer", path);
  }
});
