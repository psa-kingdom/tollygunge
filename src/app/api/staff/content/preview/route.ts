import { authorized, operation, OperationError } from "@/lib/operation-api";
import { previewContext } from "@/lib/content-preview";
import { pageSlugs } from "@/domain/operations";
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request, "content:publish");
    const page = new URL(request.url).searchParams.get("page") ?? "";
    if (!pageSlugs.includes(page as (typeof pageSlugs)[number]))
      throw new OperationError("Choose a website page.");
    return previewContext(page);
  });
}
