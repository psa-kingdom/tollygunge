import { operation } from "@/lib/operation-api";
import { receiptUpload } from "@/lib/finance-upload";
export async function POST(r: Request) {
  return operation(() => receiptUpload(r, false));
}
