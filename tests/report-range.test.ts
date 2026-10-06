import test from "node:test";
import assert from "node:assert/strict";
import { reportRange } from "../src/domain/report-range";
test("report ranges accept open periods and reject invalid calendar dates or reversed periods", () => {
  assert.deepEqual(reportRange(new URLSearchParams()), {
    from: null,
    to: null,
  });
  assert.deepEqual(
    reportRange(new URLSearchParams("from=2024-02-29&to=2024-03-01")),
    { from: "2024-02-29", to: "2024-03-01" },
  );
  for (const query of [
    "from=2025-02-29",
    "from=0000-01-01",
    "to=invalid",
    "from=2026-10-06&to=2026-10-05",
    "from=2026-13-01",
  ])
    assert.throws(() => reportRange(new URLSearchParams(query)));
});
