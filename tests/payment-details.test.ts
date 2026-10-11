import test from "node:test";
import assert from "node:assert/strict";
import { paymentDetails, paymentQrKey } from "../src/domain/payment-details";
test("payment configuration validates payee instructions and excludes transaction status", () => {
  const details = paymentDetails({
    label: "Association",
    payee: "TPA payee",
    upiId: "tpa@example",
    phone: "+91 1234567890",
    status: "paid",
  });
  assert.equal(details.qrId, null);
  assert.ok(!("status" in details));
  assert.throws(() => paymentDetails({ ...details, upiId: "bad" }));
  assert.throws(() => paymentDetails({ ...details, phone: "invalid" }));
  assert.throws(() => paymentQrKey("../documents"));
});
test("bank instructions need no UPI and preserve account numbers as text", () => {
  const details = paymentDetails({
    method: "bank",
    label: "Bank transfer",
    payee: "TPA payee",
    accountNumber: "00123456789",
    ifsc: "ABCD0123456",
    bank: "Example bank",
    branch: "Example branch",
    secret: "never exposed",
    upiId: "irrelevant bank field",
  });
  assert.equal(details.upiId, "");
  assert.equal(details.accountNumber, "00123456789");
  assert.ok(!("secret" in details));
  assert.throws(() => paymentDetails({ ...details, ifsc: "bad" }));
  assert.throws(() => paymentDetails({ ...details, accountNumber: "123abc" }));
});
