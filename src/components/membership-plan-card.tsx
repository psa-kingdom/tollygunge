import type { ReactNode } from "react";
import { rupees } from "@/domain/finance";
import { planTotal, type MembershipPlanDetails } from "@/domain/membership-plans";
import styles from "./membership-plans-manager.module.css";

export function MembershipPlanCard({
  name,
  plan,
  current = false,
  heading: Heading = "h3",
  actions,
}: {
  name: string;
  plan?: MembershipPlanDetails;
  current?: boolean;
  heading?: "h2" | "h3";
  actions?: ReactNode;
}) {
  return (
    <article className={styles.card}>
      <Heading className={styles.planName}>
        {name}
        {current && <span className={styles.currentPlan}>Your plan</span>}
      </Heading>
      {plan && (
        <>
          <p className={styles.price}>
            {plan.cost_configured ? rupees(planTotal(plan)) : "Cost not set"}
          </p>
          {plan.cost_configured && (
            <p className={styles.help}>
              {rupees(plan.cost_paise)} base +{" "}
              {(plan.gst_basis_points ?? 0) / 100}% GST
            </p>
          )}
          {plan.benefits && (
            <p className={actions ? styles.benefits : styles.fullBenefits}>
              {plan.benefits}
            </p>
          )}
        </>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
    </article>
  );
}
