import { randomBytes } from "node:crypto";
import {
  authorized,
  operation,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
import { uuid, version } from "@/domain/operations";
import { provisionMemberAccount, memberFromBody } from "@/lib/member-register";
import { hashToken, queueOnboardingMail } from "@/lib/onboarding-mail";
export async function POST(r: Request) {
  return operation(async () => {
    const actor = await authorized(r, "staff:manage", true),
      i = await jsonBody(r, 5000),
      id = uuid(i.personId);
    if (!["invite", "resend", "release", "membership"].includes(i.action))
      throw new OperationError("Choose a member operation.");
    return transaction(async (c) => {
      const p = (
        await c.query("SELECT * FROM tpa.people WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      const m = (
        await c.query(
          "SELECT * FROM tpa.memberships WHERE person_id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!p || !m) throw new OperationError("Member not found.", 404);
      if (i.action === "membership") {
        if (m.version !== version(i.version))
          throw new OperationError("Membership changed. Reload.", 409);
        if (!["active", "expired", "suspended", "resigned"].includes(i.status))
          throw new OperationError("Choose a membership status.");
        await c.query(
          "UPDATE tpa.memberships SET status=$2,version=version+1,updated_at=now() WHERE id=$1",
          [m.id, i.status],
        );
        await audit(c, actor.id, "membership." + i.status, m.id);
        return { saved: true };
      }
      if (process.env.ONBOARDING_ENABLED !== "true")
        throw new OperationError("Invitations are disabled.", 503);
      if (!p.user_id) {
        const result = await provisionMemberAccount(
          c,
          id,
          memberFromBody(
            { ...p.accepted, email: p.contact_email },
            m.membership_number,
          ),
        );
        await audit(c, actor.id, "member.invited", id);
        return result;
      }
      await c.query('SELECT id FROM public."user" WHERE id=$1 FOR UPDATE', [
        p.user_id,
      ]);
      if (
        (
          await c.query(
            'SELECT 1 FROM public."account" WHERE "userId"=$1 AND "providerId"=\'credential\'',
            [p.user_id],
          )
        ).rowCount ||
        (
          await c.query(
            "SELECT 1 FROM tpa.onboarding_invitations WHERE user_id=$1 AND redeemed_at IS NOT NULL",
            [p.user_id],
          )
        ).rowCount
      )
        throw new OperationError(
          "Invitation already accepted. Use account recovery.",
          409,
        );
      const held = (
        await c.query(
          "SELECT user_id FROM tpa.account_invitation_holds WHERE user_id=$1 AND released_at IS NULL FOR UPDATE",
          [p.user_id],
        )
      ).rowCount;
      if (held && i.action !== "release")
        throw new OperationError(
          "Invitation delivery is held. Explicitly release it before sending.",
          409,
          "invitation_held",
        );
      if (!held && i.action === "release")
        throw new OperationError("No held invitation exists.", 409);
      if (i.action !== "resend" && i.action !== "release")
        throw new OperationError(
          "An invitation already exists. Review its status before resending.",
          409,
        );
      if (
        (
          await c.query(
            "SELECT 1 FROM tpa.onboarding_mail WHERE user_id=$1 AND kind='invitation' AND (status IN ('queued','leased') OR created_at>now()-interval '10 minutes' OR reason='uncertain_send_expired')",
            [p.user_id],
          )
        ).rowCount
      )
        throw new OperationError(
          "Invitation is queued, recently sent, or needs delivery reconciliation.",
          409,
        );
      await c.query(
        "DELETE FROM tpa.onboarding_invitations WHERE user_id=$1 AND redeemed_at IS NULL",
        [p.user_id],
      );
      const token = randomBytes(32).toString("base64url");
      await c.query(
        "INSERT INTO tpa.onboarding_invitations(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '48 hours')",
        [hashToken(token), p.user_id],
      );
      await queueOnboardingMail(
        c,
        p.user_id,
        p.contact_email,
        "invitation",
        `${process.env.BETTER_AUTH_URL}/invitation#token=${token}`,
        "member-resend-" + hashToken(token),
      );
      if (held)
        await c.query(
          "UPDATE tpa.account_invitation_holds SET released_at=now() WHERE user_id=$1",
          [p.user_id],
        );
      await audit(
        c,
        actor.id,
        held ? "member.invitation_released" : "member.invitation_resent",
        id,
      );
      return { invitationQueued: true };
    });
  });
}
