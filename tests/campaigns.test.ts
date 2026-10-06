import test from "node:test";
import assert from "node:assert/strict";
import { campaignDetails, campaignAudience } from "../src/domain/campaigns";
test("campaign drafts normalize audience criteria and reject header injection and privilege fields", () => {
  const input = {
    name: " Newsletter ",
    subject: " Association news ",
    body: "Some association news for subscribers.",
    audience: {
      city: " Kolkata ",
      profession: " Accounting ",
      includeUnsubscribed: true,
    },
    status: "sent",
  };
  const result = campaignDetails(input);
  assert.equal(result.name, "Newsletter");
  assert.deepEqual(result.audience, {
    city: "Kolkata",
    profession: "Accounting",
  });
  assert.equal("status" in result, false);
  assert.throws(() =>
    campaignDetails({ ...input, subject: "News\r\nBcc: anyone" }),
  );
  assert.throws(() => campaignAudience({ city: "x".repeat(121) }));
  assert.throws(() => campaignAudience({ profession: 12 }));
});
