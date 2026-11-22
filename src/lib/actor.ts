import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { authConfigured, getAuth } from "./auth";
import { getDatabase } from "./database";
// React cache deduplicates only within this server render; authorization stays request-scoped.
export const currentActor = cache(async function currentActor(requestHeaders?: Headers) {
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
  let plan: string | undefined;
  let profileVerified: boolean | undefined;
  try {
    const memRes = await getDatabase().query<{ type: string | null; accepted_verified: boolean }>(
      "SELECT m.type,p.accepted_verified FROM tpa.people p LEFT JOIN tpa.memberships m ON m.person_id=p.id WHERE p.user_id=$1 AND p.archived_at IS NULL LIMIT 1",
      [session.user.id],
    );
    profileVerified = memRes.rows[0]?.accepted_verified ?? false;
    if (memRes.rows[0]?.type) {
      plan = memRes.rows[0].type;
    } else {
      const draftRes = await getDatabase().query<{ plan: string }>(
        "SELECT plan FROM tpa.application_drafts WHERE user_id=$1 LIMIT 1",
        [session.user.id],
      );
      if (draftRes.rows[0]?.plan) plan = draftRes.rows[0].plan;
    }
  } catch {
    // Tolerant if table not accessible
  }
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roles: rows.map((row) => row.role),
    plan,
    profileVerified,
  };
});
