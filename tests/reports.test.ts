import test from "node:test";
import assert from "node:assert/strict";
import {
  reportFilters,
  resolvePeriod,
  permittedReports,
  csvText,
  exportLimit,
} from "../src/domain/reports";
test("India report periods cross UTC midnight, leap days and financial-year boundaries", () => {
  const filter = (period: string) =>
    reportFilters(new URLSearchParams({ period }));
  assert.deepEqual(
    resolvePeriod(filter("month"), new Date("2026-03-31T18:30:00Z")),
    { from: "2026-04-01", to: "2026-04-30" },
  );
  assert.deepEqual(
    resolvePeriod(filter("financial"), new Date("2026-03-31T18:29:59Z")),
    { from: "2025-04-01", to: "2026-03-31" },
  );
  assert.deepEqual(
    resolvePeriod(filter("financial"), new Date("2026-03-31T18:30:00Z")),
    { from: "2026-04-01", to: "2027-03-31" },
  );
  assert.deepEqual(
    resolvePeriod(filter("previous"), new Date("2024-03-01T00:00:00Z")),
    { from: "2024-02-01", to: "2024-02-29" },
  );
  assert.deepEqual(
    resolvePeriod(filter("last30"), new Date("2026-01-01T00:00:00Z")),
    { from: "2025-12-03", to: "2026-01-01" },
  );
  assert.throws(() =>
    reportFilters(new URLSearchParams({ from: "2026-02-30" })),
  );
  assert.throws(() =>
    reportFilters(new URLSearchParams({ review: "approved" })),
  );
  assert.throws(() =>
    reportFilters(
      new URLSearchParams({ from: "2026-10-08", to: "2026-01-01" }),
    ),
  );
});
test("report domains and spreadsheet boundaries do not confer membership or formula execution", () => {
  assert.deepEqual(permittedReports(["membership_reviewer"]), ["accounts"]);
  assert.deepEqual(permittedReports(["finance_operator"]), []);
  assert.deepEqual(permittedReports([]), []);
  for (const value of ["=HYPERLINK(1)", " +123", "@SUM(A1)", "\tvalue", "-42"])
    assert.ok(csvText(value).startsWith("\"'"));
  assert.equal(csvText('safe,"quoted"'), '"safe,""quoted"""');
  assert.doesNotThrow(() => exportLimit(10000));
  assert.throws(() => exportLimit(10001), /Narrow/);
});
