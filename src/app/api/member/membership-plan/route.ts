import { operation, OperationError } from "@/lib/operation-api";

export async function POST() {
  return operation(async () => {
    throw new OperationError("Only staff can change membership plans.", 403);
  });
}
