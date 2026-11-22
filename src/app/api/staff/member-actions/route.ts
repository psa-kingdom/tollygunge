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
    if (input.action === "membership-plan") {
      if (
        !["Life", "Patron"].includes(input.plan) ||
        typeof input.userId !== "string" ||
        !input.userId ||
        input.userId.length > 200
      )
        throw new OperationError(
          "Choose a member account and a Life or Patron plan.",
        );
      return transaction(async (client) => {
        const {
          rows: [account],
        } = await client.query(
          'SELECT "requestedMembershipPlan" AS plan FROM public."user" WHERE id=$1 FOR UPDATE',
          [input.userId],
        );
        const {
          rows: [person],
        } = await client.query(
          "SELECT id,archived_at FROM tpa.people WHERE user_id=$1 FOR UPDATE",
          [input.userId],
        );
        if (!account || person?.archived_at)
          throw new OperationError("Member account not found.", 404);
        if (account.plan && account.plan !== input.plan)
          throw new OperationError(
            "A membership plan is already selected.",
            409,
          );
        if (person) {
          const { rows: [membership] } = await client.query(
            "SELECT id,type FROM tpa.memberships WHERE person_id=$1 FOR UPDATE",
            [person.id],
          );
          if (membership?.type && !["Annual", input.plan].includes(membership.type))
            throw new OperationError(
              "A membership plan is already selected.",
              409,
            );
          if (membership && membership.type !== input.plan)
            await client.query(
              "UPDATE tpa.memberships SET type=$2,version=version+1,updated_at=now() WHERE id=$1",
              [membership.id, input.plan],
            );
        }
        await client.query(
          'UPDATE public."user" SET "requestedMembershipPlan"=$2 WHERE id=$1',
          [input.userId, input.plan],
        );
        await client.query(
          "UPDATE tpa.application_drafts SET plan=$2,version=version+1,updated_at=now() WHERE user_id=$1 AND plan IS DISTINCT FROM $2",
          [input.userId, input.plan],
        );
        await audit(
          client,
          actor.id,
          "membership.plan_assigned",
          person?.id ?? input.userId,
        );
        return { saved: true };
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
