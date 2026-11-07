import {
  authorized,
  operation,
  jsonBody,
  transaction,
} from "@/lib/operation-api";
import { financeMutation, financeRead } from "@/lib/finance";
import { hasPermission } from "@/domain/access";
export async function GET(r: Request) {
  return operation(async () => {
    const actor = await authorized(r, "payments:manage");
    return {
      ...(await financeRead(new URL(r.url).searchParams)),
      actorId: actor.id,
      reviewer: hasPermission(actor.roles, "finance:approve"),
    };
  });
}
export async function POST(r: Request) {
  return operation(async () => {
    const actor = await authorized(r, "payments:manage", true),
      i = await jsonBody(r);
    return transaction((c) => financeMutation(c, actor, i));
  });
}
