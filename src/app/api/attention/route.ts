import { authorized, operation } from "@/lib/operation-api";
import { attentionFor } from "@/lib/attention";
export async function GET(request: Request) {
  return operation(async () => ({
    items: await attentionFor(await authorized(request)),
  }));
}
