import { createHmac, timingSafeEqual } from "node:crypto";

export const verificationResultCookie = "tpa-email-verification-result";
type Result = {
  status: "verified" | "expired" | "invalid";
  email?: string;
  expires: number;
};

export function signVerificationResult(
  result: Omit<Result, "expires">,
  secret: string,
  now = Date.now(),
) {
  const payload = Buffer.from(
    JSON.stringify({ ...result, expires: now + 10 * 60_000 }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", secret)
      .update("email-verification-result:" + payload)
      .digest("base64url")
  );
}

export function readVerificationResult(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): Result | null {
  if (!value || value.length > 2048) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", secret)
    .update("email-verification-result:" + payload)
    .digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null;
  try {
    const result = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      !["verified", "expired", "invalid"].includes(result.status) ||
      !Number.isFinite(result.expires) ||
      result.expires <= now
    )
      return null;
    if (
      result.email !== undefined &&
      (typeof result.email !== "string" || result.email.length > 254)
    )
      return null;
    return result;
  } catch {
    return null;
  }
}

/** Keep browser email links independent of whichever account is already signed in. */
export async function handleVerificationLink(
  request: Request,
  handler: (request: Request) => Promise<Response>,
  secret: string,
) {
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    !url.pathname.endsWith("/verify-email") ||
    !url.searchParams.has("callbackURL")
  )
    return handler(request);
  let email: string | undefined;
  try {
    const claims = JSON.parse(
      Buffer.from(
        (url.searchParams.get("token") ?? "").split(".")[1] ?? "",
        "base64url",
      ).toString("utf8"),
    );
    // Leave Better Auth's separate email-change flow intact.
    if (claims.updateTo) return handler(request);
    if (typeof claims.email === "string" && claims.email.length <= 254)
      email = claims.email;
  } catch {
    /* Better Auth determines whether the token is valid. */
  }
  url.searchParams.delete("callbackURL");
  const response = await handler(new Request(url, request));
  let result: Omit<Result, "expires"> = { status: "invalid" };
  try {
    const body = await response.clone().json();
    if (response.ok && body.status === true && email)
      result = { status: "verified", email };
    else if (body.code === "TOKEN_EXPIRED") result = { status: "expired" };
  } catch {
    /* Never show success without the authentication handler's confirmation. */
  }
  const headers = new Headers(response.headers);
  headers.delete("content-type");
  headers.delete("content-length");
  headers.set("location", "/email-verification");
  headers.set("cache-control", "no-store");
  headers.set("referrer-policy", "no-referrer");
  headers.append(
    "set-cookie",
    `${verificationResultCookie}=${signVerificationResult(result, secret)}; Path=/email-verification; Max-Age=600; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
  );
  return new Response(null, { status: 303, headers });
}
