import test from "node:test";
import assert from "node:assert/strict";
import {
  upcomingMemberEvents,
  overviewEventState,
  portalActivityLabel,
  type OverviewEvent,
} from "../src/domain/portal-presentation";
const sample: OverviewEvent = {
  id: "event",
  title: "TPA workshop",
  starts_at: "2026-11-01T10:00:00Z",
  ends_at: "2026-11-01T12:00:00Z",
  status: "published",
  registration_id: "registration",
  registration_status: "registered",
  fee_paise: 10000,
  payment_status: "pending",
};
test("member actions distinguish event payment evidence, confirmation and terminal states", () => {
  assert.equal(
    overviewEventState(sample).label,
    "Event payment reference needed",
  );
  assert.equal(
    overviewEventState({ ...sample, payment_reference: "BANK-1" }).label,
    "Event payment awaiting verification",
  );
  assert.equal(
    overviewEventState({ ...sample, payment_status: "failed" }).tone,
    "error",
  );
  assert.equal(
    overviewEventState({ ...sample, payment_status: "paid" }).label,
    "Registration confirmed",
  );
  for (const status of ["refunded", "cancelled", "unknown"])
    assert.notEqual(
      overviewEventState({ ...sample, payment_status: status }).label,
      "Registration confirmed",
    );
  assert.equal(
    overviewEventState({ ...sample, registration_fee_paise: 0 }).label,
    "Registration confirmed",
  );
  assert.equal(
    overviewEventState({ ...sample, registration_status: "cancelled" }).action,
    "View event",
  );
});
test("upcoming activity prioritizes registrations and excludes past or closed event records", () => {
  const now = Date.parse("2026-10-29T00:00:00Z");
  const rows = upcomingMemberEvents(
    [
      {
        ...sample,
        id: "open",
        registration_id: null,
        registration_status: null,
        starts_at: "2026-10-30T10:00:00Z",
      },
      sample,
      { ...sample, id: "past", ends_at: "2026-10-28T00:00:00Z" },
      { ...sample, id: "archived", archived_at: "2026-10-28" },
      { ...sample, id: "cancelled", status: "cancelled" },
      { ...sample, id: "complete", completed_at: "2026-10-28" },
    ],
    now,
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ["event", "open"],
  );
});
test("audit descriptions stay readable without inventing unknown outcomes", () => {
  assert.equal(
    portalActivityLabel("verification.submitted"),
    "Profile submitted for review",
  );
  assert.equal(
    portalActivityLabel("application.draft_saved"),
    "Application draft saved",
  );
  assert.equal(
    portalActivityLabel("custom.record_updated"),
    "Custom record updated",
  );
});
