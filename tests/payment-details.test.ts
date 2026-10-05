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
