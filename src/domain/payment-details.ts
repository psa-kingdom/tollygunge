import { record, text, uuid } from "./operations";
export function paymentDetails(value: unknown) {
  const body = record(value);
  const upiId = text(body.upiId, "UPI ID", 120, 3);
  if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(upiId))
    throw new Error("Invalid UPI ID.");
  const phone = text(body.phone ?? "", "Phone number", 20);
  if (phone && !/^\+?[0-9][0-9 -]{6,18}$/.test(phone))
    throw new Error("Invalid phone number.");
  return {
    label: text(body.label, "Label", 100, 3),
    payee: text(body.payee, "Payee", 120, 3),
    upiId,
    phone,
    qrId: body.qrId ? uuid(body.qrId) : null,
  };
}
export function paymentQrKey(id: string) {
  return `tpa/payments/qr/${uuid(id)}`;
}
