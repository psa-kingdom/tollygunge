import { record, text, uuid } from "./operations";
export function paymentDetails(value: unknown) {
  const body = record(value);
  const method = body.method ?? "upi";
  if (!["upi", "bank"].includes(String(method)))
    throw new Error("Choose UPI or bank transfer.");
  const upiId =
    method === "upi" ? text(body.upiId ?? "", "UPI ID", 120, 3) : "";
  if (upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(upiId))
    throw new Error("Invalid UPI ID.");
  const bank =
    method === "bank"
      ? {
          accountNumber: text(body.accountNumber, "Account number", 34, 1),
          ifsc: text(body.ifsc, "IFSC", 11, 11),
          bank: text(body.bank, "Bank", 160, 1),
          branch: text(body.branch, "Branch", 160, 1),
        }
      : {};
  if (
    method === "bank" &&
    (!/^\d{6,34}$/.test(bank.accountNumber!) ||
      !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.ifsc!))
  )
    throw new Error("Check account number and IFSC.");
  const phone = text(body.phone ?? "", "Phone number", 20);
  if (phone && !/^\+?[0-9][0-9 -]{6,18}$/.test(phone))
    throw new Error("Invalid phone number.");
  return {
    method: method as "upi" | "bank",
    ...bank,
    label: text(body.label, "Label", 100, 3),
    payee: text(body.payee, "Payee", 120, 3),
    upiId,
    phone,
    qrId: method === "upi" && body.qrId ? uuid(body.qrId) : null,
  };
}
export function paymentQrKey(id: string) {
  return `tpa/payments/qr/${uuid(id)}`;
}
