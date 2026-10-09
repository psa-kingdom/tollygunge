import "server-only";
import { headers } from "next/headers";
import { authConfigured, getAuth } from "./auth";
import { getDatabase } from "./database";
export async function currentActor(requestHeaders?: Headers) {
  if (!authConfigured()) return null;
  const session = await getAuth().api.getSession({
    headers: requestHeaders ?? (await headers()),
  });
  if (!session) return null;
  const { rows } = await getDatabase().query<{ role: string }>(
    "SELECT role FROM tpa.staff_roles WHERE user_id=$1",
    [session.user.id],
  );
  if (
    !session.user.emailVerified &&
    (rows.length || process.env.ONBOARDING_ENABLED !== "true")
  ) {
    const approved = await getDatabase().query(
      "SELECT 1 FROM tpa.operator_approved_identities WHERE user_id=$1",
      [session.user.id],
    );
    if (!approved.rowCount) return null;
  }
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roles: rows.map((row) => row.role),
  };
}
