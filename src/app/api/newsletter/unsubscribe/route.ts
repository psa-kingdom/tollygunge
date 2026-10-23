import { getDatabase } from "@/lib/database";
import { unsubscribePublicSubscription } from "@/lib/public-newsletter";
import { emailOperation } from "@/lib/email-operation";
import { OperationError, jsonBody } from "@/lib/operation-api";
import { boundedBody } from "@/domain/request-body";
import { isSameOrigin } from "@/lib/request-policy";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return emailOperation(async () => {
    if (!process.env.DATABASE_URL) throw new OperationError("Subscriptions are temporarily unavailable. Please try again later.", 503);
    const queryToken = new URL(request.url).searchParams.get("token");
    if (queryToken && request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
      const raw = new TextDecoder().decode(await boundedBody(request, 4096));
      if (new URLSearchParams(raw).get("List-Unsubscribe") !== "One-Click") throw new OperationError("Invalid unsubscribe request.");
      return unsubscribePublicSubscription(getDatabase(), queryToken);
    }
    if (!isSameOrigin(request)) throw new OperationError("Request origin is not allowed.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new OperationError("Use the subscription form.", 415);
    const input = await jsonBody(request, 4096);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new OperationError("Use the subscription form.");
    return unsubscribePublicSubscription(getDatabase(), input.token);
  });
}
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return Response.json({ error: "Invalid link." }, { status: 400 });
  return new Response(null, { status: 303, headers: { Location: `/newsletter/unsubscribe#token=${token}`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
