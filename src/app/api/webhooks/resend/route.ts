import { recordOnboardingEvent } from "@/lib/onboarding-delivery";
import { Webhook } from "svix";
import { boundedBody } from "@/domain/request-body";
import { getDatabase } from "@/lib/database";
import { recordEmailEvent } from "@/lib/email-events";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret)
    return Response.json({ error: "Webhook unavailable." }, { status: 503 });
  let event: unknown;
  const id = request.headers.get("svix-id") ?? "";
  try {
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) throw Error();
    const payload = new TextDecoder().decode(
      await boundedBody(request, 262144),
    );
    new Webhook(secret).verify(payload, {
      "svix-id": id,
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    });
    event = JSON.parse(payload);
  } catch {
    return Response.json({ error: "Invalid webhook." }, { status: 400 });
  }
  try {
    await recordEmailEvent(getDatabase(), id, event);
    await recordOnboardingEvent(getDatabase(), id, event);
    return Response.json(
      { received: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Webhook processing unavailable." },
      { status: 503 },
    );
  }
}
