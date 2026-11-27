ALTER TABLE public."user" DROP CONSTRAINT "user_requestedMembershipPlan_check";
ALTER TABLE public."user" ADD CONSTRAINT user_requested_plan FOREIGN KEY("requestedMembershipPlan") REFERENCES tpa.membership_plans(code);
