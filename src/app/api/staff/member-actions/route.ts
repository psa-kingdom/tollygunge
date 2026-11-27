
import {
  authorized,
  operation,
  jsonBody,
  transaction,
  audit,
  OperationError,
} from "@/lib/operation-api";
import { uuid, version } from "@/domain/operations";
import { deleteMember } from "@/lib/member-deletion";
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, "staff:manage", true),
      input = await jsonBody(request, 5000);
    if (input.action === "review-plan-change") {
      const personId = uuid(input.personId);
      if (!["approve", "decline"].includes(input.decision) ||
          (typeof input.plan !== "string" || input.plan.length > 80))
        throw new OperationError("Choose a plan change decision.");
      return transaction(async (client) => {
        const { rows: [member] } = await client.query(
          `SELECT p.accepted_verified,m.id,m.pending_plan,m.status
           FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id
           WHERE p.id=$1 AND p.archived_at IS NULL
           FOR UPDATE OF p,m`,
          [personId],
        );
        if (!member || member.pending_plan !== input.plan)
          throw new OperationError("This request has changed. Reload the member record.", 409);

        const approved = input.decision === "approve";
        if (approved && !(await client.query("SELECT 1 FROM tpa.membership_plans WHERE code=$1 AND active", [input.plan])).rowCount)
          throw new OperationError("This plan has been deleted. Decline this request and choose an available plan.", 409);
        if (approved && member.status !== "active")
          throw new OperationError("Only active memberships can change plans.", 409);
        if (approved && input.plan !== "Free" &&
            (!member.accepted_verified || input.requirementsConfirmed !== true))
          throw new OperationError("Verify the member's profile and confirm any applicable payment before approving.");
        await client.query(
          `UPDATE tpa.memberships
           SET type=CASE WHEN $2 THEN pending_plan ELSE type END,
               pending_plan=NULL,version=version+1,updated_at=now()
           WHERE id=$1`,
          [member.id, approved],
        );
        await audit(client, actor.id, approved ? "membership.plan_change_approved" : "membership.plan_change_declined", member.id);
        return { saved: true };
      });
    }
    if (input.action === "membership-plan") {
      if (typeof input.plan !== "string" || !["Free", "Life", "Patron"].includes(input.plan))
        throw new OperationError("Choose an available membership plan.");
      const personId = input.personId ? uuid(input.personId) : null;
      if (!personId && (typeof input.userId !== "string" || !input.userId || input.userId.length > 200))
        throw new OperationError("Choose a member.");
      return transaction(async (client) => {
        if (!(await client.query("SELECT 1 FROM tpa.membership_plans WHERE code=$1 AND active", [input.plan])).rowCount)
          throw new OperationError("Choose an available membership plan.");
        const { rows: [person] } = await client.query(
          "SELECT id,user_id,archived_at FROM tpa.people WHERE ($1::uuid IS NOT NULL AND id=$1) OR ($1::uuid IS NULL AND user_id=$2) FOR UPDATE",
          [personId, input.userId ?? null],
        );
        if ((personId && !person) || person?.archived_at)
          throw new OperationError("Member not found.", 404);
        const { rows: [membership] } = person ? await client.query(
          "SELECT id,type,version,pending_plan FROM tpa.memberships WHERE person_id=$1 FOR UPDATE", [person.id],
        ) : { rows: [] };
        if (membership && version(input.version) !== membership.version)
          throw new OperationError("This member changed. Reload before assigning a plan.", 409);
        const userId = person?.user_id ?? (personId ? null : input.userId);
        const { rows: [user] } = userId
          ? await client.query('SELECT "requestedMembershipPlan" FROM public."user" WHERE id=$1 FOR UPDATE', [userId])
          : { rows: [] };
        if (userId && !user)
          throw new OperationError("Member account not found.", 404);
        if (!membership && !userId) throw new OperationError("Member not found.", 404);
        if (input.onlyIfUnassigned === true && (membership?.type ?? user?.requestedMembershipPlan))
          throw new OperationError("A plan is already assigned. Reload the member record.", 409);
        if (membership) await client.query(
          "UPDATE tpa.memberships SET type=$2,pending_plan=CASE WHEN $3 THEN pending_plan ELSE NULL END,version=version+1,updated_at=now() WHERE id=$1",
          [membership.id, input.plan, input.onlyIfUnassigned === true],
        );
        if (userId) {
          await client.query('UPDATE public."user" SET "requestedMembershipPlan"=$2,"updatedAt"=now() WHERE id=$1', [userId, input.plan]);
          await client.query("UPDATE tpa.application_drafts SET plan=$2,version=version+1,updated_at=now() WHERE user_id=$1 AND plan IS DISTINCT FROM $2", [userId, input.plan]);
        }
        await audit(client, actor.id, "membership.plan_assigned", person?.id ?? userId);
        return { saved: true, plan: input.plan, membershipVersion: membership ? membership.version + 1 : 0 };
      });
    }
    const id = uuid(input.personId);
    if (["invite", "resend", "release"].includes(input.action))
      throw new OperationError(
        "Review recipients and the approved template before confirming invitations.",
        409,
        "invitation_review_required",
      );
    if (input.action === "delete")
      return transaction((c) =>
        deleteMember(
          c,
          actor.id,
          id,
          version(input.personVersion),
          version(input.version),
        ),
      );
    if (input.action !== "membership")
      throw new OperationError("Choose a member operation.");
    return transaction(async (c) => {
      const member = (
        await c.query(
          "SELECT m.*,p.accepted_verified FROM tpa.memberships m JOIN tpa.people p ON p.id=m.person_id WHERE p.id=$1 AND p.archived_at IS NULL FOR UPDATE OF p,m",
          [id],
        )
      ).rows[0];
      if (!member) throw new OperationError("Member not found.", 404);
      if (member.version !== version(input.version))
        throw new OperationError("Membership changed. Reload.", 409);
      if (
        !["active", "expired", "suspended", "resigned"].includes(input.status)
      )
        throw new OperationError("Choose a membership status.");
      if (input.status === "active" && !member.accepted_verified)
        throw new OperationError(
          "Approve the account application before activating membership.",
          409,
        );
      await c.query(
        "UPDATE tpa.memberships SET status=$2,version=version+1,updated_at=now() WHERE id=$1",
        [member.id, input.status],
      );
      await audit(c, actor.id, "membership." + input.status, member.id);
      return { saved: true };
    });
  });
}
