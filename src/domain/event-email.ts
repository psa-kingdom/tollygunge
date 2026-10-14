import { eventTime } from "./event-flow";
export type MailEvent = { id: string; title: string; starts_at: string | Date; location: string; fee_paise: number; status?: string };
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function eventEmail(event: MailEvent, state: string, origin: string, registration?: { id: string; fee_paise: number; payment_status: string }) {
  const messages: Record<string, string> = {
    registration_cancelled: "Your registration has been cancelled. Any payment already made remains recorded for staff refund review. No automatic refund has been made.",
    event_cancelled: "This event has been cancelled. Any payment already made remains recorded for staff refund review. No automatic refund has been made.",
    pending: "Your place is reserved pending manual payment verification. This is not a payment confirmation.",
    paid: "Your registration is confirmed. Payment has been verified by staff.",
    not_required: "Your registration is confirmed. No payment is required.",
    failed: "Your payment could not be verified. Contact the association for help completing payment.",
    refunded: "Staff has recorded your payment as refunded. Your registration is cancelled.",
    cancelled: "Your payment and registration have been cancelled. Contact the association if you need help.",
    event_update: "The event details have changed. Please review the updated details below.",
    reminder_confirmed: "Your event is coming up. Your registration is confirmed; we look forward to seeing you.",
    reminder_pending: "Your event is coming up. Your place is reserved, but payment still needs manual verification. This is not a registration confirmation.",
  };
  if (!messages[state]) throw Error("Unsupported event email.");
  const url = `${origin}/member/events?eventId=${event.id}`;
  const fee = registration?.fee_paise ?? event.fee_paise;
  const lines = [event.title, "", messages[state], "", `When: ${eventTime(event.starts_at)}`, `Venue / joining instructions: ${event.location}`, `Fee: ${fee ? "₹" + (fee / 100).toFixed(2) : "Free"}`];
  if (registration) lines.push(`Registration: ${registration.id}`, `Payment status: ${registration.payment_status}`);
  lines.push("", `View your event: ${url}`);
  if (state === "pending" || state === "reminder_pending" || state === "failed") lines.push(`Payment instructions: ${origin}/member/events?eventId=${event.id}`, "Include your registration identifier when contacting the association.");
  lines.push("", "Tollygunge Professional Association");
  return {
    subject: `TPA ${state.startsWith("reminder") ? "event reminder" : state.startsWith("event_") ? "event update" : "registration update"} · ${event.title.replace(/[\r\n]/g, " ")}`,
    text: lines.join("\n"),
    html: `<main style="font-family:Arial;max-width:620px;margin:24px auto;color:#172a40"><h2>Tollygunge Professional Association</h2>${lines.map((line) => `<p>${escape(line)}</p>`).join("")}<a href="${escape(url)}">View event and registration</a></main>`,
  };
}
