import test from "node:test";
import assert from "node:assert/strict";
import { api, ApiError } from "../src/components/operations-client";
test("proxy HTML, expired sessions and network failures produce safe messages without replaying writes", async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, body, expected] of [[502, "private proxy HTML", "temporarily unavailable"], [401, '{"error":"private"}', "Sign in again"], [403, '{"error":"private"}', "permission"], [500, '{"error":"private SQL"}', "temporarily unavailable"]] as const) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return new Response(body, { status }); };
      await assert.rejects(api("/api/example", { action: "save" }), (error: unknown) => error instanceof ApiError && error.message.includes(expected) && !error.message.includes("private"));
      assert.equal(calls, 1);
    }
    globalThis.fetch = async () => { throw new Error("private network URL"); };
    await assert.rejects(api("/api/example"), /Unable to connect/);
  } finally { globalThis.fetch = original; }
});
