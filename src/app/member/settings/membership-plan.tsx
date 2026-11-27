import { MembershipPlanCard } from "@/components/membership-plan-card";
import styles from "@/components/membership-plans-manager.module.css";
import type { MembershipPlanDetails } from "@/domain/membership-plans";

export function MembershipPlan({
  plans,
  current,
}: {
  plans: MembershipPlanDetails[];
  current: string | null;
}) {
  const visiblePlans = plans.filter(
    (plan) => plan.active || plan.code === current,
  );

  return (
    <section className={styles.workspace} aria-labelledby="membership-plan-heading">
      <h1 id="membership-plan-heading">Membership plan</h1>
      {!current && <p>No current plan recorded.</p>}
      <div className={styles.cards}>
        {current && !visiblePlans.some((plan) => plan.code === current) && (
          <MembershipPlanCard name={current} current heading="h2" />
        )}
        {visiblePlans.map((plan) => (
          <MembershipPlanCard
            key={plan.code}
            name={plan.name}
            plan={plan}
            current={plan.code === current}
            heading="h2"
          />
        ))}
      </div>
    </section>
  );
}
