import {
  operation,
  authorized,
  jsonBody,
  transaction,
  OperationError,
  audit,
} from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { queueOnboardingMail } from "@/lib/onboarding-mail";
import { randomUUID } from "node:crypto";
export async function GET(r: Request) {
  return operation(async () => {
    await authorized(r, "staff:manage");
    const db = getDatabase();
    return {
      settings: (
        await db.query("SELECT * FROM tpa.onboarding_settings WHERE id=true")
      ).rows[0],
      configured:
        !!process.env.RESEND_API_KEY &&
        process.env.RESEND_DOMAIN_VERIFIED === "true",
      mail: (
        await db.query(
          "SELECT id,recipient,kind,status,attempts,created_at FROM tpa.onboarding_mail ORDER BY created_at DESC LIMIT 100",
        )
      ).rows,
    };
  });
}
export async function POST(r: Request) {
  return operation(async () => {
    const actor = await authorized(r, "staff:manage", true),
      i = await jsonBody(r);
    return transaction(async (c) => {
      const s = (
        await c.query(
          "SELECT * FROM tpa.onboarding_settings WHERE id=true FOR UPDATE",
        )
      ).rows[0];
      if (i.action === "test") {
        if (
          !s.test_recipients.includes(i.recipient) ||
          ![
            "welcome",
            "verification",
            "recovery",
            "invitation",
            "update",
          ].includes(i.kind)
        )
          throw new OperationError(
            "Select a configured test recipient and template.",
          );
        await queueOnboardingMail(
          c,
          null,
          i.recipient,
          i.kind,
          `${process.env.BETTER_AUTH_URL}/login`,
          "test-" + randomUUID(),
        );
        await audit(c, actor.id, "onboarding.email_test", actor.id);
        return { queued: true };
      }
      if (
        !Array.isArray(i.recipients) ||
        i.recipients.length > 10 ||
        i.recipients.some(
          (x: unknown) =>
            typeof x !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x),
        )
      )
        throw new OperationError("Use up to 10 valid test addresses.");
      const saved = (
        await c.query(
          "UPDATE tpa.onboarding_settings SET test_recipients=$1,version=version+1 WHERE id=true AND version=$2 RETURNING *",
          [JSON.stringify(i.recipients), i.version],
        )
      ).rows[0];
      if (!saved) throw new OperationError("Settings changed.", 409);
      await audit(c, actor.id, "onboarding.email_settings", actor.id);
      return saved;
    });
  });
}
