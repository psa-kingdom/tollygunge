import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/lib/database";
import { isSameOrigin } from "@/lib/request-policy";
import { boundedBody } from "@/domain/request-body";
export async function POST(r: Request) {
  if (!isSameOrigin(r)) return new Response(null, { status: 403 });
  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(await boundedBody(r, 4000)));
  } catch {
    return new Response(null, { status: 400 });
  }
  const headers = new Headers(r.headers);
  headers.set(
    "x-tpa-keep-signed-in",
    body.keepSignedIn === true ? "true" : "false",
  );
  const email = typeof body.email === "string" ? body.email.toLowerCase() : "";
  const staff = (
    await getDatabase().query(
      'SELECT 1 FROM tpa.staff_roles r JOIN public."user" u ON u.id=r.user_id WHERE lower(u.email)=$1',
      [email],
    )
  ).rowCount;
  const days =
    body.keepSignedIn === true &&
    !staff &&
    process.env.ONBOARDING_ENABLED === "true"
      ? 30
      : 7;
  const response = await getAuth().handler(
    new Request(new URL("/api/auth/sign-in/email", r.url), {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        password: body.password,
        rememberMe: true,
      }),
    }),
  );
  const output = new Headers(response.headers);
  output.delete("set-cookie");
  for (const cookie of response.headers.getSetCookie())
    output.append(
      "set-cookie",
      cookie.includes("session_token=")
        ? cookie.replace(/Max-Age=\d+/i, `Max-Age=${days * 86400}`)
        : cookie,
    );
  return new Response(response.body, {
    status: response.status,
    headers: output,
  });
}
