import test from "node:test";
import assert from "node:assert/strict";
import { memberApplicationSteps, memberApplicationStep, memberApplicationFieldStep, adjacentApplicationStep, initialFields } from "../src/domain/verification";
test("personal and contact fields share one member step while saved field steps are retained", () => {
  assert.equal(memberApplicationSteps.length, 3);
  assert.equal(memberApplicationStep(1), memberApplicationStep(2));
  assert.equal(memberApplicationStep(3), 0);
  const merged = initialFields.filter(field => memberApplicationFieldStep(field) === 1);
  assert.ok(merged.some(field => field.id === "fullName"));
  assert.ok(merged.some(field => field.id === "phone"));
  assert.ok(merged.some(field => field.id === "officeAddress"));
  assert.ok(!merged.some(field => field.id === "interests"));
  assert.equal(initialFields.find(field => field.id === "phone")?.step, 2);
});
test("forward and backward navigation skips the combined legacy contact step", () => {
  assert.equal(adjacentApplicationStep(0, 1), 1);
  assert.equal(adjacentApplicationStep(1, 1), 4);
  assert.equal(adjacentApplicationStep(2, 1), 4);
  assert.equal(adjacentApplicationStep(3, -1), 0);
  assert.equal(adjacentApplicationStep(2, -1), 0);
  assert.equal(adjacentApplicationStep(4, 1), 4);
});

test("contribution and interest fields belong to membership and professional details", () => {
  for (const id of ["contributions", "contributionsOther", "interests", "interestsOther"]) {
    const field = initialFields.find(item => item.id === id)!;
    assert.equal(memberApplicationFieldStep(field), 0);
    assert.equal(field.step, 2);
  }
});

test("evidence fields and saved evidence-step links now open membership details", () => {
  for (const id of ["certificate"]) {
    assert.equal(memberApplicationFieldStep(initialFields.find(field => field.id === id)!), 0);
  }
  assert.equal(memberApplicationStep(3), 0);
  assert.equal(adjacentApplicationStep(4, -1), 1);
  assert.ok(!memberApplicationSteps.some(step => step.label === "Evidence"));
});

test("recent photograph belongs to personal details", () => {
 const f = initialFields.find(f => f.id === "photograph")!;
 assert.equal(memberApplicationFieldStep(f), 1);
 assert.equal(f.label, "Recent photograph");
});
