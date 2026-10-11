import { authorized, operation } from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
export async function GET(request: Request) {
  return operation(async () => {
    await authorized(request);
    return {
      collectionEnabled: false,
      records: (
        await getDatabase().query(
          "SELECT id,active_snapshot AS details FROM tpa.payment_details WHERE status='active' ORDER BY updated_at DESC",
        )
      ).rows,
    };
  });
}
