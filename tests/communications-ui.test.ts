import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignState,
  canSaveCampaign,
  emptyCampaign,
} from "../src/domain/communications-ui";

test("campaign list distinguishes drafts, queued sends, accepted sends and stopped sends", () => {
  const sent = {
    ...emptyCampaign,
    version: 2,
    dispatch_count: 1,
    last_sent_version: 2,
    accepted_count: 10,
  };
  assert.equal(campaignState(emptyCampaign), "Draft");
  assert.equal(campaignState(sent), "Sent");
  assert.equal(campaignState({ ...sent, queued_count: 2 }), "Queued");
  assert.equal(campaignState({ ...sent, version: 3 }), "Draft");
  assert.equal(campaignState({ ...sent, accepted_count: 0 }), "Needs review");
  assert.equal(campaignState({ ...sent, all_cancelled: true }), "Cancelled");
  assert.equal(campaignState({ ...sent, status: "archived" }), "Archived");
});

test("message validation prevents incomplete drafts and multiline subjects", () => {
  const entry = {
    ...emptyCampaign,
    name: "Community update",
    subject: "News from TPA",
    body: "An update for our community.",
  };
  assert.equal(canSaveCampaign(entry), true);
  assert.equal(canSaveCampaign({ ...entry, name: "  " }), false);
  assert.equal(
    canSaveCampaign({ ...entry, subject: "A subject\nAnother header" }),
    false,
  );
  assert.equal(canSaveCampaign({ ...entry, body: "Short" }), false);
  assert.equal(canSaveCampaign({ ...entry, body: "a".repeat(6001) }), false);
});
