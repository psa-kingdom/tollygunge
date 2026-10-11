import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { sealMail } from "./onboarding-mail";
export async function queueEventUpdate(
  c: PoolClient,
  event: {
    id: string;
    version: number;
    title: string;
    status: string;
    starts_at: string;
    location: string;
  },
) {
  const message =
    event.status === "cancelled"
      ? "This event has been cancelled. Any paid registration remains recorded for staff refund review; no automatic refund has been made."
      : `The event details have changed. Date: ${new Date(event.starts_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST. Location: ${event.location}.`;
  const text = `${event.title}\n\n${message}\n\nView details: ${process.env.BETTER_AUTH_URL}/member/events\n\nTollygunge Professional Association`;
  const payload = sealMail({
    subject: `TPA event update · ${event.title.replace(/[\r\n]/g, " ")}`,
    text,
    html: `<main style="font-family:Arial;max-width:620px;margin:24px auto;color:#142e40"><h2>Tollygunge Professional Association</h2><p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p></main>`,
  });
  await c.query(
    `INSERT INTO tpa.onboarding_mail(id,dedupe,user_id,recipient,kind,payload) SELECT gen_random_uuid(),$1||r.id::text,r.user_id,u.email,'event_update',$2 FROM tpa.event_registrations r JOIN public."user" u ON u.id=r.user_id WHERE r.event_id=$3 AND r.status='registered' ON CONFLICT(dedupe) DO NOTHING`,
    ["event-update-" + event.version + "-", payload, event.id],
  );
}
export async function queueEventMail(
  c: PoolClient,
  userId: string,
  title: string,
  state: string,
  dedupe: string,
) {
  const user = (
    await c.query('SELECT email FROM public."user" WHERE id=$1', [userId])
  ).rows[0];
  const message =
    state === "registration_cancelled"
      ? "Your registration has been cancelled. Any payment already made remains recorded for staff refund review. No automatic refund has been made."
      : state === "pending"
        ? "Your place is reserved pending manual payment verification. This is not a payment confirmation."
        : state === "paid" || state === "not_required"
          ? "Your registration is confirmed."
          : `Your payment status is now ${state}. Contact the association if you need help.`;
  const text = `${title}\n\n${message}\n\nView your registration: ${process.env.BETTER_AUTH_URL}/member/events\n\nTollygunge Professional Association`;
  const escape = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch]!,
    );
  await c.query(
    "INSERT INTO tpa.onboarding_mail(id,dedupe,user_id,recipient,kind,payload) VALUES($1,$2,$3,$4,'event_status',$5) ON CONFLICT(dedupe) DO NOTHING",
    [
      randomUUID(),
      "event-" + dedupe,
      userId,
      user.email,
      sealMail({
        subject: `TPA · ${title.replace(/[\r\n]/g, " ")}`,
        text,
        html: `<main style="font-family:Arial;max-width:620px;margin:24px auto;color:#142e40"><h2>Tollygunge Professional Association</h2><p>${escape(title)}</p><p>${escape(message)}</p><p><a href="${escape(process.env.BETTER_AUTH_URL! + "/member/events")}">View registration</a></p></main>`,
      }),
    ],
  );
}
