import { OperationError, operation } from "./operation-api";
import { EmailOperationError } from "./email-service";
export async function emailOperation(work: () => Promise<unknown>) {
  const response = await operation(async () => {
    try {
      return await work();
    } catch (e) {
      if (e instanceof EmailOperationError)
        throw new OperationError(e.message, e.status);
      throw e;
    }
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
