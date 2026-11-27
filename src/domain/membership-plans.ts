export type MembershipPlanDetails = {
  code: string;
  name: string;
  cost_paise: number;
  cost_configured: boolean;
  benefits: string;
  version: number;
  active?: boolean;
  gst_basis_points?: number;
};

export const defaultMembershipPlans: MembershipPlanDetails[] = [
  {
    code: "Free",
    name: "Free",
    cost_paise: 0,
    cost_configured: true,
    benefits:
      "Community membership and registration for public events. Event fees may apply.",
    version: 1,
  },
  {
    code: "Life",
    name: "Life",
    cost_paise: 0,
    cost_configured: false,
    benefits: "",
    version: 1,
  },
  {
    code: "Patron",
    name: "Patron",
    cost_paise: 0,
    cost_configured: false,
    benefits: "",
    version: 1,
  },
];

export function planGst(
  plan: Pick<MembershipPlanDetails, "cost_paise" | "gst_basis_points">,
) {
  return Math.round((plan.cost_paise * (plan.gst_basis_points ?? 0)) / 10000);
}
export function planTotal(
  plan: Pick<MembershipPlanDetails, "cost_paise" | "gst_basis_points">,
) {
  return plan.cost_paise + planGst(plan);
}
