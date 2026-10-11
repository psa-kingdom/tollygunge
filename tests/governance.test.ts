import test from "node:test";
import assert from "node:assert/strict";
import { governanceProfile } from "../src/domain/governance";
test("association profiles do not grant identity or membership and require valid group details", () => {
  const body = {
    name: "Synthetic person",
    role: "Chair",
    group: "executive",
    order: 0,
  };
  const result = governanceProfile({
    ...body,
    userId: "invented",
    roles: ["administrator"],
    membershipNumber: "invented",
  });
  assert.ok(!("userId" in result));
  assert.ok(!("roles" in result));
  assert.ok(!("membershipNumber" in result));
  assert.throws(() => governanceProfile({ ...body, group: "subcommittee" }));
  assert.throws(() => governanceProfile({ ...body, order: 1000 }));
  assert.throws(() => governanceProfile({ ...body, portraitId: "bad" }));
});
