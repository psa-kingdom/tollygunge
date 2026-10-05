import nodemailer from "nodemailer";

export function recoveryConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return Boolean(
    env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.AUTH_EMAIL_FROM,
  );
}

export async function sendRecoveryEmail(
  email: string,
  url: string,
  env: Record<string, string | undefined>,
) {
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
      subject: "Reset your TPA password",
      text: `A password reset was requested for your TPA account.\n\n${url}\n\nThis link expires in 15 minutes and can be used once. If you did not request this, ignore this email.`,
    });
  } catch {
    // Provider errors can include addresses, credentials or message bodies.
    throw new Error("Email recovery delivery failed");
  } finally {
    transport.close();
  }
}
