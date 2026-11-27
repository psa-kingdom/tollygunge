import { operation } from "@/lib/operation-api";
import { membershipPlans } from "@/lib/membership-plans";
export async function GET() {
  return operation(async () => ({ plans: await membershipPlans() }));
}
