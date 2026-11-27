"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import {
  defaultMembershipPlans,
  type MembershipPlanDetails,
} from "@/domain/membership-plans";
export function useMembershipPlans() {
  const [plans, setPlans] = useState<MembershipPlanDetails[]>(
    defaultMembershipPlans,
  );
  useEffect(() => {
    let active = true;
    api<{ plans: MembershipPlanDetails[] }>("/api/public/membership-plans")
      .then((data) => {
        if (active) setPlans(data.plans);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return plans;
}
