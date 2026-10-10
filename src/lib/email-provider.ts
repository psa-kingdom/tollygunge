import { type EmailQuota } from "../domain/email";
export class EmailProviderError extends Error {
  constructor(
    public transient: boolean,
    public ambiguous: boolean,
    public code: string,
  ) {
    super("Email provider operation unavailable.");
  }
}
export async function providerRequest(
  path: string,
  key: string,
  body?: unknown,
  idempotency?: string,
) {
  let response: Response;
  try {
    response = await fetch(`https://api.resend.com${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
  } catch {
    throw new EmailProviderError(true, !!body, "network");
  }
  if (!response.ok) {
    let name = "";
    try {
      const details = await response.json();
      name = typeof details.name === "string" ? details.name : "";
    } catch {}
    const suppressed = ["invalid_to_address", "invalid_email_address"].includes(
      name,
    );
    throw new EmailProviderError(
      response.status === 429 || response.status >= 500,
      response.status >= 500,
      suppressed
        ? "invalid_recipient"
        : response.status === 429
          ? "rate_limited"
          : response.status === 403
            ? "configuration"
            : "provider_rejected",
    );
  }
  try {
    const reader = response.body?.getReader();
    if (!reader) throw Error();
    let length = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        length += next.value.byteLength;
        if (length > 2 * 1024 * 1024) {
          await reader.cancel();
          throw new EmailProviderError(false, !!body, "response_too_large");
        }
        chunks.push(next.value);
      }
    } finally {
      reader.releaseLock();
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof EmailProviderError) throw error;
    throw new EmailProviderError(true, !!body, "invalid_response");
  }
}
export async function fetchEmailQuota(key: string): Promise<EmailQuota> {
  const result = await providerRequest("/usage", key);
  const daily = result.emails?.daily,
    monthly = result.emails?.monthly;
  for (const w of [daily, monthly])
    if (
      !w ||
      !Number.isFinite(w.used) ||
      w.used < 0 ||
      !(w.limit === null || (Number.isFinite(w.limit) && w.limit >= 0)) ||
      !Number.isFinite(Date.parse(w.resets_at))
    )
      throw new EmailProviderError(true, false, "quota_unavailable");
  return { daily, monthly };
}
