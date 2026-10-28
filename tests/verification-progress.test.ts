import test from "node:test";
import assert from "node:assert/strict";
import { initialFields, verificationProgress } from "../src/domain/verification";

test("new profiles start at zero and link missing items to their form steps", () => {
  const progress = verificationProgress(initialFields, {}, "Professional", false);
  assert.equal(progress.total, 10);
  assert.equal(progress.completed, 0);
  assert.equal(progress.percent, 0);
  assert.equal(progress.remaining[0].href, "/member/application?step=0");
  assert.equal(progress.remaining.find(item => item.id === "email")?.href, "/member#verification-email-action");
  assert.equal(verificationProgress(initialFields, { fullName: "Synthetic member" }, "Professional", true).percent, 20);
});

test("completion includes conditional registration and selected-address requirements", () => {
  const answers: Record<string, string> = Object.fromEntries(initialFields.filter(f => f.required).map(f => [f.id, f.type === "checkbox" ? "true" : "Synthetic value"]));
  answers.correspondenceAddress = "Office";
  let progress = verificationProgress(initialFields, answers, "Professional", true);
  assert.equal(progress.total, 11);
  assert.equal(progress.remaining.length, 1);
  assert.equal(progress.remaining[0].id, "selected-address");
  assert.equal(progress.remaining[0].href, "/member/application?step=2");
  answers.officeAddress = "Synthetic office address";
  assert.equal(verificationProgress(initialFields, answers, "Professional", true).percent, 100);
  answers.professionalBody = "CA";
  progress = verificationProgress(initialFields, answers, "Professional", true);
  assert.equal(progress.total, 12);
  assert.equal(progress.remaining[0].id, "registration");
  answers.registration = "SYNTHETIC-123";
  assert.equal(verificationProgress(initialFields, answers, "Professional", true).percent, 100);
});

test("progress follows published field configuration rather than a hard-coded ten", () => {
  const fields = initialFields.map(f => f.id === "qualification" ? { ...f, required: false } : f);
  assert.equal(verificationProgress(fields, {}, "Professional", false).total, 9);
  assert.equal(verificationProgress(fields, {}, "Professional", false).remaining.some(item => item.id === "qualification"), false);
});
