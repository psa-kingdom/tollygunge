import nodemailer from "nodemailer";
import { createHash } from "node:crypto";

export function resendRecoveryConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  // Enabled only after operational verification of the sending domain.
  return Boolean(
    env.RESEND_API_KEY &&
    env.RESEND_DOMAIN_VERIFIED === "true" &&
    /^[^\r\n<>\s]+@(?:[a-z0-9-]+\.)*tpassociation\.org$/i.test(
      env.AUTH_EMAIL_FROM ?? "",
    ),
  );
}

export function recoveryConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.RESEND_API_KEY) return resendRecoveryConfigured(env);
  return (
    resendRecoveryConfigured(env) ||
    Boolean(
      env.SMTP_HOST &&
      env.SMTP_USER &&
      env.SMTP_PASSWORD &&
      env.AUTH_EMAIL_FROM,
    )
  );
}

export async function sendRecoveryEmail(
  email: string,
  url: string,
  env: Record<string, string | undefined>,
) {
  const subject = "Reset your TPA password";
  const text = `A password reset was requested for your TPA account.\n\n${url}\n\nThis link expires in 15 minutes and can be used once. If you did not request this, ignore this email.`;
  if (env.RESEND_API_KEY) {
    // A partly configured Resend deployment must not silently switch providers.
    if (!resendRecoveryConfigured(env))
      throw new Error("Email recovery unavailable");
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `recovery-${createHash("sha256").update(email).update("\0").update(url).digest("hex")}`,
        },
        body: JSON.stringify({
          from: env.AUTH_EMAIL_FROM,
          to: [email],
          subject,
          text,
        }),
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
      if (!response.ok) throw new Error("Rejected");
      const result = (await response.json()) as { id?: unknown };
      if (typeof result.id !== "string" || !result.id)
        throw new Error("Invalid receipt");
      return result.id;
    } catch {
      // Never expose response bodies, reset tokens, addresses or provider errors.
      throw new Error("Email recovery delivery failed");
    }
    return;
  }
  const port = Number(env.SMTP_PORT ?? "465");
  if (!recoveryConfigured(env) || ![465, 587].includes(port))
    throw new Error("Email recovery unavailable");
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
    tls: { rejectUnauthorized: true },
    logger: false,
    debug: false,
    connectionTimeout: 15000,
    socketTimeout: 20000,
  });
  try {
    await transport.sendMail({
      from: env.AUTH_EMAIL_FROM,
      to: email,
      subject,
      text,
    });
  } catch {
    // Provider errors can include addresses, credentials or message bodies.
    throw new Error("Email recovery delivery failed");
  } finally {
    transport.close();
  }
}
