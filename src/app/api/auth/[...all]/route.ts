import { authConfigured, getAuth } from "@/lib/auth";
import { handleVerificationLink } from "@/lib/email-verification-result";
export const runtime = "nodejs";
async function handler(request: Request) {
  if (!authConfigured())
    return Response.json(
      { error: "Sign-in is being configured." },
      { status: 503 },
    );
  return handleVerificationLink(
    request,
    (input) => getAuth().handler(input),
    process.env.BETTER_AUTH_SECRET!,
  );
}
export { handler as GET, handler as POST };
