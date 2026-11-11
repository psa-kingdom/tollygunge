import test from "node:test";
import assert from "node:assert/strict";
import { initialFields, missingFields, validateAnswers } from "../src/domain/verification";
import { validEventDate, eventInDateRange } from "../src/domain/event-date-range";
test("gender accepts the three requested options without inferring from title", () => {
  for (const gender of ["Male", "Female", "Transgender"]) assert.equal(validateAnswers({ gender }, initialFields).gender, gender);
  assert.throws(() => validateAnswers({ gender: "Mr" }, initialFields));
});
test("typed legacy signature does not satisfy mandatory signature document", () => {
  assert.ok(missingFields(initialFields, { signature: "Sample Member" }, "Professional", true).includes("Applicant signature or signed form"));
  assert.ok(!missingFields(initialFields, { signatureDocument: "saved-document" }, "Professional", true).includes("Applicant signature or signed form"));
});
test("date ranges include endpoints, support open bounds and reject reversed bounds", () => {
  assert.ok(eventInDateRange("2026-11-01", "2026-11-01", "2026-11-30"));
  assert.ok(eventInDateRange("2026-11-30", "2026-11-01", "2026-11-30"));
  assert.ok(!eventInDateRange("2026-12-01", "2026-11-01", "2026-11-30"));
  assert.ok(eventInDateRange("2026-01-01", "", "2026-11-30"));
  assert.ok(!eventInDateRange("2026-11-15", "2026-11-30", "2026-11-01"));
  assert.equal(validEventDate("2026-02-30"), "");
  assert.equal(validEventDate("2028-02-29"), "2028-02-29");
});
