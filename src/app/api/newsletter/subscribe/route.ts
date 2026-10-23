import { getDatabase } from "@/lib/database";
import { requestPublicSubscription } from "@/lib/public-newsletter";
import { emailOperation } from "@/lib/email-operation";
import { OperationError, jsonBody } from "@/lib/operation-api";
import { isSameOrigin } from "@/lib/request-policy";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return emailOperation(async () => {
    if (!process.env.DATABASE_URL) throw new OperationError("Subscriptions are temporarily unavailable. Please try again later.", 503);
    if (!isSameOrigin(request)) throw new OperationError("Request origin is not allowed.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new OperationError("Use the subscription form.", 415);
    const input = await jsonBody(request, 4096);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new OperationError("Use the subscription form.");
    return requestPublicSubscription(getDatabase(), input);
  });
}
