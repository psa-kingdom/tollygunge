import {
  authorized,
  operation,
  jsonBody,
  transaction,
  OperationError,
} from "@/lib/operation-api";
import { financeMutation, financeRead, financeWriter } from "@/lib/finance";
import { ensureHistoricalFinanceEvent, historicalFinanceDate, historicalFinanceEvents } from "@/lib/finance-events";
import { uuid } from "@/domain/operations";
import { canWriteFinance, financeReviewScope } from "@/domain/access";
export async function GET(r: Request) {
  return operation(async () => {
    const actor = await authorized(r, "finance:read");
    return {
      ...(await financeRead(new URL(r.url).searchParams)),
      actorId: actor.id,
      reviewer: financeReviewScope(actor.roles) !== "member",
      reviewScope: financeReviewScope(actor.roles),
      canWriteExpenses: canWriteFinance(actor.roles, true),
    };
  });
}
export async function POST(r: Request) {
  return operation(async () => {
    const actor = await authorized(r, "finance:read", true),
      i = await jsonBody(r);
    const id = uuid(i.eventId);
    const date = historicalFinanceDate(id);
    const historical = date ? (await historicalFinanceEvents(date)).find(event => event.id === id) : undefined;
    if (date && !historical) throw new OperationError("Historical event not found.", 404);

    return transaction(async (client) => {
      if (historical && !["approve", "return"].includes(i.action)) {
        financeWriter(actor, i.action);
        await ensureHistoricalFinanceEvent(client, actor.id, historical);
      }
      return financeMutation(client, actor, i);
    });
  });
}
