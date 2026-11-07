import test from "node:test";
import assert from "node:assert/strict";
import {
  expenseLines,
  financeDate,
  financeAmount,
  financeTotals,
  balanceLabel,
} from "../src/domain/finance";
import { hasPermission, staffRoleLabel } from "../src/domain/access";
test("approved ledger totals exclude pending, returned, and superseded revisions", () => {
  const r = (kind: string, status: string, amount_paise: number) => ({
    kind,
    status,
    amount_paise,
  });
  assert.deepEqual(
    financeTotals([
      r("receipt", "approved", 10000),
      r("refund", "approved", 2000),
      r("expenses", "superseded", 7000),
      r("expenses", "approved", 9000),
      r("receipt", "submitted", 5000),
      r("expenses", "submitted", 11000),
      r("receipt", "returned", 1000),
    ]),
    {
      received: 10000,
      refunded: 2000,
      expenses: 9000,
      netCollected: 8000,
      netResult: -1000,
      pendingReceipts: 5000,
      pendingExpenses: 11000,
    },
  );
  assert.match(balanceLabel(-1000), /^Deficit/);
  assert.match(balanceLabel(1), /^Surplus/);
  assert.equal(balanceLabel(0), "Balanced ₹0");
});
test("expense headers are custom and currency and dates are validated", () => {
  assert.equal(
    expenseLines([
      {
        header: "Stage & lighting",
        description: "Sound equipment",
        date: "2026-11-05",
        amountPaise: 12000,
      },
    ])[0].header,
    "Stage & lighting",
  );
  for (const value of [0, -1, 1.1, NaN, 100000001, "100"])
    assert.throws(() => financeAmount(value));
  for (const value of ["2026-02-30", "2026-13-01", "2026-1-1"])
    assert.throws(() => financeDate(value));
  assert.throws(() => expenseLines([]));
});
test("approval and staff role administration are reserved for super admin", () => {
  assert.equal(hasPermission(["administrator"], "finance:approve"), false);
  assert.equal(hasPermission(["finance_operator"], "finance:approve"), false);
  assert.equal(hasPermission(["administrator"], "staff:roles"), false);
  assert.equal(hasPermission(["super_administrator"], "staff:roles"), true);
  assert.equal(hasPermission(["super_administrator"], "finance:approve"), true);
  assert.equal(staffRoleLabel("administrator"), "Admin");
});
