import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { clean, email as normalizeEmail } from "@/domain/member-foundation";
import { hashToken, queueOnboardingMail } from "./onboarding-mail";
import { OperationError } from "./operation-error";
/** Caller owns the transaction/savepoint; existing accounts are never altered. */
export async function createInvitedAccount(
  c: PoolClient,
  input: { name: string; email: string },
  hold?: { batchId: string },
) {
  if (process.env.ONBOARDING_ENABLED !== "true")
    throw new OperationError(
      "Onboarding is disabled.",
      503,
      "onboarding_disabled",
    );
  const email = normalizeEmail(input.email, true),
    name = clean(input.name, "name", 200),
    accountId = randomUUID();
  const created = (
    await c.query(
      'INSERT INTO public."user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,false,now(),now()) ON CONFLICT DO NOTHING RETURNING id',
      [accountId, name, email],
    )
  ).rows[0];
  if (!created) return null;
  if (hold) {
    await c.query(
      "INSERT INTO tpa.account_invitation_holds(user_id,source_batch_id) VALUES($1,$2)",
      [accountId, hold.batchId],
    );
    return {
      accountId,
      invitationQueued: false,
      invitationStatus: "held" as const,
    };
  }
  const token = randomBytes(32).toString("base64url");
  await c.query(
    "INSERT INTO tpa.onboarding_invitations(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '48 hours')",
    [hashToken(token), accountId],
  );
  await queueOnboardingMail(
    c,
    accountId,
    email,
    "invitation",
    `${process.env.BETTER_AUTH_URL}/invitation#token=${token}`,
    "invite-" + accountId,
  );
  return { accountId, invitationQueued: true };
}
