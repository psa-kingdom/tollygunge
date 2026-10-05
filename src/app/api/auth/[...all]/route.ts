import { authConfigured, getAuth } from "@/lib/auth";
export const runtime = "nodejs";
async function handler(request: Request) {
  if (!authConfigured())
    return Response.json(
      { error: "Sign-in is being configured." },
      { status: 503 },
    );
  return getAuth().handler(request);
}
export { handler as GET, handler as POST };
