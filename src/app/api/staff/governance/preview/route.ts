import { authorized, operation, OperationError } from "@/lib/operation-api";
import { staffPeople } from "@/lib/people-service";
import { previewContext } from "@/lib/content-preview";
import { publishedPage } from "@/lib/public-content";
export async function GET(request: Request) {
  return operation(async () => {
    const actor = await authorized(request);
    if (!staffPeople(actor)) throw new OperationError("Access denied.", 403);
    const page = new URL(request.url).searchParams.get("page");
    if (!["about", "governance"].includes(page ?? ""))
      throw new OperationError("Choose a public page.");
    return {
      ...(await previewContext(page!)),
      pageContent: await publishedPage(page!),
    };
  });
}
