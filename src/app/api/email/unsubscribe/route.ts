import { boundedBody } from "@/domain/request-body";
import { getDatabase } from "@/lib/database";
import { unsubscribe } from "@/lib/email-service";
import { emailOperation } from "@/lib/email-operation";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    return Response.json({ error: "Invalid link." }, { status: 400 });
  return new Response(null,{status:303,headers:{Location:`${process.env.BETTER_AUTH_URL}/unsubscribe#token=${token}`,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
}
export async function POST(request: Request) {
  return emailOperation(async () => {
    const raw = new TextDecoder().decode(await boundedBody(request, 4096));
    const type = request.headers.get("content-type") ?? "";
    let token = new URL(request.url).searchParams.get("token") ?? "";
    if (type.startsWith("application/json")) {
      const body = JSON.parse(raw);
      token = typeof body.token === "string" ? body.token : "";
    } else if (type.startsWith("application/x-www-form-urlencoded")) {
      if (new URLSearchParams(raw).get("List-Unsubscribe") !== "One-Click")
        throw Error("Invalid request.");
    } else throw Error("Invalid request.");
    return unsubscribe(getDatabase(), token);
  });
}
