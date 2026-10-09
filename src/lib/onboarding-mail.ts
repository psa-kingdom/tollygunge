import {
  randomUUID,
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import type { Pool, PoolClient } from "pg";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function onboardingEmail(kind: string, url: string) {
  const subjects: Record<string, string> = {
    welcome: "Welcome to TPA",
    verification: "Verify your TPA email",
    recovery: "Reset your TPA password",
    invitation: "Your TPA account invitation",
    update: "Update your TPA verification details",
  };
  const messages: Record<string, string> = {
    welcome:
      "Your account is ready. Complete your details and evidence to request profile verification. Account creation does not approve membership.",
    verification:
      "Verify your email using the link below. This link expires in 24 hours.",
    recovery:
      "Set a new password using the link below. This single-use link expires in 15 minutes. If you did not request it, ignore this email.",
    invitation:
      "TPA has created an account for you. Set your password using this single-use link within 48 hours, then complete your details and documents to request verification.",
    update:
      "Your Verified badge remains active. Please complete the newly required details in your portal.",
  };
  if (!subjects[kind]) throw Error("Unsupported transactional email.");
  const escaped = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  return {
    subject: subjects[kind],
    text: `${messages[kind]}\n\n${url}\n\nTollygunge Professional Association`,
    html: `<html><body><main style="font-family:Arial;max-width:620px;margin:24px auto;color:#142e40"><h2>Tollygunge Professional Association</h2><p>${escaped(messages[kind])}</p><p><a href="${escaped(url)}">Continue to TPA</a></p></main></body></html>`,
  };
}
export function sealMail(
  value: unknown,
  secret = process.env.BETTER_AUTH_SECRET!,
) {
  if (!secret) throw Error("Mail encryption is unavailable.");
  const nonce = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      createHash("sha256")
        .update("tpa-mail" + secret)
        .digest(),
      nonce,
    );
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return {
    sealed: bytes.toString("base64"),
    nonce: nonce.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}
export function openMail(
  value: { sealed: string; nonce: string; tag: string },
  secret = process.env.BETTER_AUTH_SECRET!,
) {
  const cipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256")
      .update("tpa-mail" + secret)
      .digest(),
    Buffer.from(value.nonce, "base64"),
  );
  cipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      cipher.update(Buffer.from(value.sealed, "base64")),
      cipher.final(),
    ]).toString("utf8"),
  );
}
export async function queueOnboardingMail(
  db: Pool | PoolClient,
  userId: string | null,
  email: string,
  kind: string,
  url: string,
  dedupe: string,
) {
  await db.query(
    "INSERT INTO tpa.onboarding_mail(id,dedupe,user_id,recipient,kind,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(dedupe) DO NOTHING",
    [
      randomUUID(),
      dedupe,
      userId,
      email.toLowerCase(),
      kind,
      sealMail(onboardingEmail(kind, url)),
    ],
  );
}
