import "server-only";
import { getDatabase } from "./database";
import type { MembershipPlanDetails } from "@/domain/membership-plans";

export async function membershipPlans(includeInactive = false): Promise<MembershipPlanDetails[]> {
  return (await getDatabase().query<MembershipPlanDetails>(
    "SELECT code,name,cost_paise,cost_configured,benefits,version,active,gst_basis_points FROM tpa.membership_plans WHERE ($1 OR active) ORDER BY CASE code WHEN 'Free' THEN 0 WHEN 'Life' THEN 1 ELSE 2 END, name",
    [includeInactive],
  )).rows;
}
