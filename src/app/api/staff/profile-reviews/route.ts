import {
  authorized,
  operation,
  jsonBody,
  transaction,
  OperationError,
} from "@/lib/operation-api";
import { admin, changePerson } from "@/lib/people-service";
export async function POST(request: Request) {
  return operation(async () => {
    const actor = await authorized(request, undefined, true);
    if (!admin(actor))
      throw new OperationError("Administrator review required.", 403);
    const input = await jsonBody(request);
    if (!["approve", "reject"].includes(input.action))
      throw new OperationError("Choose approve or reject.");
    return transaction((client) => changePerson(client, actor, input));
  });
}
