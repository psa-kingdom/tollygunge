import { createHash } from "node:crypto";
import { convert } from "html-to-text";
export const inboxAddress = "contact@updates.tpassociation.org";
export const campaignAddress = "updates@updates.tpassociation.org";
export function emailAddress(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 500 ||
    /[\r\n\x00-\x1f]/.test(value)
  )
    throw new Error("Choose a valid email address.");
  if (value.includes("<") !== value.includes(">"))
    throw new Error("Choose a valid email address.");
  const match = /^(?:[^<>]*<)?([^<>\s,;]+@[^<>\s,;]+)>?$/.exec(value.trim());
  const result = match?.[1].toLowerCase();
  if (
    !result ||
    result.length > 254 ||
    !/^[^@]+@(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i.test(result)
  )
    throw new Error("Choose a valid email address.");
  return result;
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function emailConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.EMAIL_OPERATIONS_ENABLED === "true" &&
    env.RESEND_DOMAIN_VERIFIED === "true" &&
    !!env.RESEND_API_KEY &&
    (!!env.RESEND_RECEIVING_API_KEY ||
      env.RESEND_RECEIVING_CONFIGURED === "true") &&
    !!env.RESEND_WEBHOOK_SECRET
  );
}
export function escaped(value: string) {
  return value.replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ]!,
  );
}
export function campaignEmail(body: string, unsubscribe: string) {
  return {
    text: `${body}\n\nTollygunge Professional Association\nUnsubscribe: ${unsubscribe}`,
    html: `<!doctype html><html><body><main style="max-width:640px;margin:24px auto;font-family:Arial,sans-serif;color:#142e40"><h2>Tollygunge Professional Association</h2><div style="white-space:pre-wrap;line-height:1.6">${escaped(body)}</div><hr><p><a href="${escaped(unsubscribe)}">Unsubscribe from the TPA newsletter</a></p></main></body></html>`,
  };
}
export function incomingText(text: unknown, html: unknown) {
  const rendered =
    typeof text === "string"
      ? text
      : typeof html === "string"
        ? convert(html, {
            wordwrap: false,
            selectors: [
              { selector: "img", format: "skip" },
              { selector: "script", format: "skip" },
              { selector: "style", format: "skip" },
              { selector: "a", options: { ignoreHref: true } },
            ],
          })
        : "";
  return rendered.replace(/\x00/g, "").slice(0, 100000);
}
export function messageId(value: unknown): string | null {
  return typeof value === "string" && /^<[^<>\r\n]{1,250}>$/.test(value)
    ? value
    : null;
}
export type QuotaWindow = {
  used: number;
  limit: number | null;
  resets_at: string;
};
export type EmailQuota = { daily: QuotaWindow; monthly: QuotaWindow };
export function quotaPause(quota: EmailQuota, kind: string, now = new Date()) {
  const blocked = [quota.daily, quota.monthly].filter(
    (w, i) =>
      w.limit !== null &&
      w.used >=
        Math.max(0, w.limit - (kind === "campaign" && i === 0 ? 20 : 0)),
  );
  if (!blocked.length) return null;
  const reset = Math.max(...blocked.map((w) => Date.parse(w.resets_at)));
  return new Date(
    Number.isFinite(reset) && reset > now.getTime()
      ? reset + 1000
      : now.getTime() + 60000,
  );
}
export function deliveryOutcome(types: string[]) {
  for (const [type, status] of [
    ["email.complained", "complained"],
    ["email.bounced", "bounced"],
    ["email.suppressed", "suppressed"],
    ["email.failed", "failed"],
    ["email.delivered", "delivered"],
    ["email.delivery_delayed", "delayed"],
    ["email.sent", "sent"],
  ] as const)
    if (types.includes(type)) return status;
  return "awaiting_event";
}
