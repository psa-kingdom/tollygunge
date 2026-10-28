import test from "node:test";
import assert from "node:assert/strict";
import { dashboardMetricPresentation } from "../src/domain/dashboard-presentation";

test("metric treatments follow meaning when permissions remove or reorder cards", () => {
  const labels = ["Payments needing verification", "Total members", "Upcoming events"];
  assert.deepEqual(labels.map(label => dashboardMetricPresentation(label, 2)), [
    { icon: "wallet", tone: "warning" },
    { icon: "people", tone: "blue" },
    { icon: "calendar", tone: "teal" },
  ]);
});

test("zero counts and unknown metrics stay neutral", () => {
  for (const label of ["Profiles needing review", "Membership issues", "Invitations held", "Payments needing verification", "Active members"])
    assert.equal(dashboardMetricPresentation(label, 0).tone, "neutral");
  assert.deepEqual(dashboardMetricPresentation("Future metric", 2), { icon: "chart", tone: "neutral" });
});
