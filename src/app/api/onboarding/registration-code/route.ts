import { email } from "@/domain/member-foundation";
import { issueRegistrationCode } from "@/lib/registration-code";
import { isSameOrigin } from "@/lib/request-policy";
import {
  jsonBody,
  operation,
  OperationError,
  transaction,
} from "@/lib/operation-api";

export async function POST(request: Request) {
  return operation(async () => {
    if (!isSameOrigin(request))
      throw new OperationError("Request origin is not allowed.", 403);
    if (
      process.env.ONBOARDING_ENABLED !== "true" ||
      process.env.TPA_SIGNUP_OTP_REQUIRED === "false" ||
      !process.env.BETTER_AUTH_SECRET
    )
      throw new OperationError("Registration is not available.", 503);
    const input = await jsonBody(request, 1024);
    const recipient = email(input?.email, true);
    await transaction((client) =>
      issueRegistrationCode(client, recipient, process.env.BETTER_AUTH_SECRET!),
    );
    return { sent: true };
  });
}
