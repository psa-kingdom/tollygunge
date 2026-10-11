import test from "node:test";
import assert from "node:assert/strict";
import { recoveryConfigured, sendRecoveryEmail } from "../src/lib/auth-email";

const env = {
  RESEND_API_KEY: "synthetic-test-key",
  RESEND_DOMAIN_VERIFIED: "true",
  AUTH_EMAIL_FROM: "no-reply@mail.tpassociation.org",
};
test("Resend recovery requires an explicitly verified TPA sender", async () => {
  assert.equal(recoveryConfigured(env), true);
  for (const invalid of [
    { ...env, RESEND_DOMAIN_VERIFIED: "false" },
    { ...env, AUTH_EMAIL_FROM: "onboarding@resend.dev" },
    { ...env, AUTH_EMAIL_FROM: "sender@tpassociation.org.evil.invalid" },
    {
      ...env,
      AUTH_EMAIL_FROM: "sender@tpassociation.org\r\nBcc: other@example.invalid",
    },
  ]) {
    assert.equal(recoveryConfigured(invalid), false);
    await assert.rejects(
      sendRecoveryEmail(
        "test@example.invalid",
        "https://tpassociation.org/reset-password#token=synthetic",
        invalid,
      ),
      /unavailable/,
    );
  }
});

test("Resend reset requests use stable opaque idempotency and suppress provider diagnostics", async () => {
  const original = globalThis.fetch;
  const keys: string[] = [];
  try {
    globalThis.fetch = async (target, init) => {
      assert.equal(target, "https://api.resend.com/emails");
      assert.equal(init?.redirect, "error");
      const headers = new Headers(init?.headers);
      keys.push(headers.get("Idempotency-Key")!);
      assert.match(keys.at(-1)!, /^recovery-[a-f0-9]{64}$/);
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.to, ["test@example.invalid"]);
      assert.match(body.html, /TPA/);
      assert.match(body.html, /15 minutes/);
      return Response.json({ id: "synthetic-id" });
    };
    const url = "https://tpassociation.org/reset-password#token=synthetic";
    await sendRecoveryEmail("test@example.invalid", url, env);
    await sendRecoveryEmail("test@example.invalid", url, env);
    await sendRecoveryEmail("test@example.invalid", `${url}-new`, env);
    assert.equal(keys[0], keys[1]);
    assert.notEqual(keys[0], keys[2]);
    for (const response of [
      Response.json({ secret: "provider-diagnostic" }, { status: 429 }),
      Response.json({}),
    ]) {
      globalThis.fetch = async () => response;
      await assert.rejects(
        sendRecoveryEmail("test@example.invalid", url, env),
        { message: "Email recovery delivery failed" },
      );
    }
    globalThis.fetch = async () => {
      throw new Error("provider-secret");
    };
    await assert.rejects(sendRecoveryEmail("test@example.invalid", url, env), {
      message: "Email recovery delivery failed",
    });
  } finally {
    globalThis.fetch = original;
  }
});
