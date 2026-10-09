import {
  operation,
  authorized,
  jsonBody,
  transaction,
  OperationError,
} from "@/lib/operation-api";
import {
  memberVerification,
  submitVerification,
} from "@/lib/verification-service";
export async function GET(r: Request) {
  return operation(async () => memberVerification(await authorized(r)));
}
export async function POST(r: Request) {
  return operation(async () => {
    if (process.env.ONBOARDING_ENABLED !== "true")
      throw new OperationError("Onboarding is disabled.", 503);
    const actor = await authorized(r, undefined, true),
      input = await jsonBody(r);
    return transaction((c) => submitVerification(c, actor, input.version));
  });
}
