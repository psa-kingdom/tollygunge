import test from "node:test";
import assert from "node:assert/strict";
import { membershipPaymentHeaders, membershipPaymentRows } from "../src/lib/membership-payment-import";

test("membership payment imports accept the three supported types and reject retired plans", () => {
  for (const plan of ["Free", "Life", "Patron"]) {
    const [row] = membershipPaymentRows([membershipPaymentHeaders, ["Test Member", "member@example.test", "9000000000", plan, "100"]]);
    assert.equal(row.error, undefined);
    assert.equal(row.plan, plan);
  }
  const [retired] = membershipPaymentRows([membershipPaymentHeaders, ["Test Member", "member@example.test", "9000000000", "Annual", "100"]]);
  assert.match(retired.error ?? "", /membership plan/);
});
