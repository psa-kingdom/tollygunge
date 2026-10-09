import test from "node:test";
import assert from "node:assert/strict";
import { Webhook } from "svix";
import {
  emailAddress,
  incomingText,
  campaignEmail,
  quotaPause,
  deliveryOutcome,
  messageId,
  tokenHash,
  emailConfigured,
} from "../src/domain/email";
test("address validation prevents header injection; incoming HTML becomes inert text", () => {
  assert.equal(
    emailAddress("Person <PERSON@example.org>"),
    "person@example.org",
  );
  for (const v of [
    "a@example.org\r\nBcc: x@x.org",
    "a@a.org,b@b.org",
    "javascript:bad",
    "<a@x.org",
    "a@x.org>",
  ])
    assert.throws(() => emailAddress(v));
  const text = incomingText(
    undefined,
    '<script>alert(1)</script><img src="https://remote.invalid/a"><p>Hello <strong>TPA</strong></p>',
  );
  assert.equal(text.trim(), "Hello TPA");
  assert.equal(incomingText("abc\0def", null), "abcdef");
  assert.equal(messageId("<safe@example.org>"), "<safe@example.org>");
  assert.equal(messageId("<bad\r\nX>"), null);
  const mail = campaignEmail(
    "<script>bad</script> & test",
    "https://tpassociation.org/unsubscribe#token=x",
  );
  assert.ok(!mail.html.includes("<script>"));
  assert.ok(mail.html.includes("&lt;script&gt;"));
  assert.match(mail.text, /Unsubscribe:/);
});
test("quota reserves twenty daily sends and waits through all blocking resets", () => {
  const q = {
    daily: { used: 80, limit: 100, resets_at: "2026-10-10T00:00:00Z" },
    monthly: { used: 20, limit: 3000, resets_at: "2026-11-01T00:00:00Z" },
  };
  assert.equal(
    quotaPause(q, "campaign", new Date("2026-10-09"))!.toISOString(),
    "2026-10-10T00:00:01.000Z",
  );
  assert.equal(quotaPause(q, "reply"), null);
  q.monthly.used = 3000;
  assert.equal(
    quotaPause(q, "campaign", new Date("2026-10-09"))!.toISOString(),
    "2026-11-01T00:00:01.000Z",
  );
});
test("event projection never replaces a complaint with an older delivered event", () => {
  assert.equal(
    deliveryOutcome(["email.complained", "email.delivered", "email.sent"]),
    "complained",
  );
  assert.equal(deliveryOutcome([]), "awaiting_event");
  assert.equal(tokenHash("x").length, 64);
  assert.equal(emailConfigured({}), false);
});
test("Svix verifies exact raw bodies; forged, changed and expired messages fail", () => {
  const w = new Webhook(
    "whsec_" + Buffer.from("synthetic-disposable-secret").toString("base64"),
  );
  const raw = JSON.stringify({ type: "email.sent" }),
    stamp = new Date(),
    id = "msg_synthetic";
  const signature = w.sign(id, stamp, raw);
  const headers = {
    "svix-id": id,
    "svix-timestamp": String(Math.floor(stamp.getTime() / 1000)),
    "svix-signature": signature,
  };
  w.verify(raw, headers);
  assert.throws(() => w.verify(raw + " ", headers));
  assert.throws(() =>
    w.verify(raw, { ...headers, "svix-signature": "v1,forged" }),
  );
  assert.throws(() => w.verify(raw, { ...headers, "svix-timestamp": "1" }));
});
