import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import {
  operation,
  jsonBody,
  transaction,
  OperationError,
  audit,
} from "@/lib/operation-api";
import { hashToken } from "@/lib/onboarding-mail";
import { isSameOrigin } from "@/lib/request-policy";
export async function POST(r: Request) {
  return operation(async () => {
    if (!isSameOrigin(r)) throw new OperationError("Invalid origin.", 403);
    const i = await jsonBody(r, 4000);
    if (
      typeof i.token !== "string" ||
      !/^[\w-]{43}$/.test(i.token) ||
      typeof i.password !== "string" ||
      i.password.length < 12 ||
      i.password.length > 128
    )
      throw new OperationError(
        "Use a valid invitation and password of 12–128 characters.",
      );

    return transaction(async (c) => {
      const token = hashToken(i.token),
        row = (
          await c.query(
            "SELECT * FROM tpa.onboarding_invitations WHERE token_hash=$1 AND redeemed_at IS NULL AND expires_at>now() FOR UPDATE",
            [token],
          )
        ).rows[0];
      if (!row)
        throw new OperationError(
          "Invitation is expired or already used. Ask TPA for a new invitation.",
          410,
        );
      await c.query('SELECT id FROM public."user" WHERE id=$1 FOR UPDATE', [
        row.user_id,
      ]);
      if (
        (
          await c.query(
            'SELECT 1 FROM public."account" WHERE "userId"=$1 AND "providerId"=\'credential\'',
            [row.user_id],
          )
        ).rowCount
      )
        throw new OperationError(
          "This account already has a password. Use password recovery.",
          409,
        );
      const password = await hashPassword(i.password);
      await c.query(
        'INSERT INTO public."account"(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,\'credential\',$2,$3,now(),now())',
        [randomUUID(), row.user_id, password],
      );
      await c.query(
        'UPDATE public."user" SET "emailVerified"=true,"updatedAt"=now() WHERE id=$1',
        [row.user_id],
      );
      await c.query(
        "UPDATE tpa.onboarding_invitations SET redeemed_at=now() WHERE token_hash=$1",
        [token],
      );
      await audit(
        c,
        row.user_id,
        "onboarding.invitation_redeemed",
        row.user_id,
      );
      return { saved: true };
    });
  });
}
