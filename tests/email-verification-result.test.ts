import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleVerificationLink,
  readVerificationResult,
  signVerificationResult,
  verificationResultCookie,
} from "../src/lib/email-verification-result";

const secret = "test-secret-for-verification-confirmation";
const token =
  "header." +
  Buffer.from(JSON.stringify({ email: "member@example.invalid" })).toString(
    "base64url",
  ) +
  ".signature";
function request(value = token) {
  return new Request(
    "https://tpa.example/api/auth/verify-email?token=" +
      value +
      "&callbackURL=%2Fmember",
    { headers: { cookie: "existing-admin-session=preserved" } },
  );
}
function receipt(response: Response) {
  return readVerificationResult(
    response.headers
      .getSetCookie()
      .find((c) => c.startsWith(verificationResultCookie + "="))
      ?.split(";")[0]
      .slice(verificationResultCookie.length + 1),
    secret,
  );
}

test("confirmation is signed, expires, and cannot be forged or altered", () => {
  const value = signVerificationResult(
    { status: "verified", email: "member@example.invalid" },
    secret,
    1000,
  );
  assert.equal(readVerificationResult(value, secret, 1001)?.status, "verified");
  assert.equal(readVerificationResult(value, secret, 601000), null);
  assert.equal(readVerificationResult(value, "wrong-secret", 1001), null);
  assert.equal(readVerificationResult("altered" + value, secret, 1001), null);
  assert.equal(readVerificationResult(value + ".extra", secret, 1001), null);
});

test("browser verification confirms the token's account and preserves the existing session", async () => {
  const response = await handleVerificationLink(
    request(),
    async (input) => {
      assert.equal(new URL(input.url).searchParams.has("callbackURL"), false);
      assert.equal(
        input.headers.get("cookie"),
        "existing-admin-session=preserved",
      );
      return Response.json(
        { status: true, user: null },
        { headers: { "set-cookie": "original-cookie=retained; HttpOnly" } },
      );
    },
    secret,
  );
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/email-verification");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(receipt(response)?.email, "member@example.invalid");
  assert.ok(
    response.headers
      .getSetCookie()
      .some((c) => c.startsWith("original-cookie=")),
  );
});

test("invalid, expired and failed authentication responses never claim success", async () => {
  for (const code of ["INVALID_TOKEN", "TOKEN_EXPIRED"]) {
    const response = await handleVerificationLink(
      request(),
      async () => Response.json({ code }, { status: 401 }),
      secret,
    );
    assert.equal(
      receipt(response)?.status,
      code === "TOKEN_EXPIRED" ? "expired" : "invalid",
    );
    assert.equal(receipt(response)?.email, undefined);
  }
  const response = await handleVerificationLink(
    request("bad"),
    async () => new Response("failure", { status: 500 }),
    secret,
  );
  assert.equal(receipt(response)?.status, "invalid");
});

test("JSON API clients and email-change callbacks keep Better Auth's existing contract", async () => {
  const response = Response.json({ status: true });
  const handler = async () => response;
  assert.equal(
    await handleVerificationLink(
      new Request("https://tpa.example/api/auth/verify-email?token=" + token),
      handler,
      secret,
    ),
    response,
  );
  const change =
    "header." +
    Buffer.from(
      JSON.stringify({
        email: "old@example.invalid",
        updateTo: "new@example.invalid",
      }),
    ).toString("base64url") +
    ".signature";
  assert.equal(
    await handleVerificationLink(request(change), handler, secret),
    response,
  );
});
