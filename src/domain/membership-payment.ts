import { record, text, uuid, version } from './operations';

export function membershipPaymentInput(value: unknown, today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())) {
  const input = record(value);
  const amount = text(input.amount, 'Amount', 12, 1);
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(amount)) throw Error('Enter a valid amount in rupees with at most two decimal places.');
  const amountPaise = Math.round(Number(amount) * 100);
  if (amountPaise < 1 || amountPaise > 999999999) throw Error('Enter an amount between ₹0.01 and ₹9,999,999.99.');
  const paidOn = text(input.paidOn, 'Payment date', 10, 10);
  const date = new Date(paidOn + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== paidOn || paidOn > today || paidOn < '1900-01-01') throw Error('Choose a valid payment date that is not in the future.');
  const method = text(input.method, 'Payment method', 20, 1);
  if (!['UPI', 'Bank transfer', 'Cash', 'Cheque'].includes(method)) throw Error('Choose a payment method.');
  if (input.confirmed !== true) throw Error('Confirm that you have verified receipt of this payment.');
  return { id: uuid(input.id), personId: uuid(input.personId), membershipVersion: version(input.membershipVersion), amountPaise, paidOn, method, reference: text(input.reference, 'Transaction or receipt reference', 100, 1) };
}

export function membershipPaymentEmail(payment: { id: string; name: string; membershipNumber: string; membershipType: string; amountPaise: number; paidOn: string; method: string; reference: string }) {
  const lines = [
    `Dear ${payment.name},`, '', 'TPA has received and verified your membership payment.', '',
    `Membership number: ${payment.membershipNumber}`, `Membership type: ${payment.membershipType}`,
    `Amount received: INR ${(payment.amountPaise / 100).toFixed(2)}`, `Payment date: ${payment.paidOn}`,
    `Payment method: ${payment.method}`, `Transaction / receipt reference: ${payment.reference}`, `Confirmation ID: ${payment.id}`, '',
    'This confirms payment receipt. It does not change the membership status.', '',
    'Thank you,', 'Tollygunge Professional Association',
  ];
  const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  return { subject: 'TPA membership payment confirmation', text: lines.join('\n'), html: `<main style="font-family:Arial;max-width:620px;margin:24px auto;color:#172a40"><h2>Membership payment confirmed</h2>${lines.map(line => `<p>${escape(line)}</p>`).join('')}</main>` };
}
