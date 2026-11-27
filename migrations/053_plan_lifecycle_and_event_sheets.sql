ALTER TABLE tpa.membership_plans DROP CONSTRAINT membership_plans_code_check;
ALTER TABLE tpa.membership_plans ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE tpa.membership_plans ADD COLUMN gst_basis_points integer NOT NULL DEFAULT 0 CHECK(gst_basis_points BETWEEN 0 AND 10000);
ALTER TABLE tpa.membership_plans ADD CONSTRAINT free_plan_gst CHECK(code<>'Free' OR gst_basis_points=0);
INSERT INTO tpa.membership_plans(code,name,cost_paise,cost_configured,benefits,active)
VALUES('Annual','Annual',0,false,'',false);
UPDATE tpa.membership_plans SET cost_paise=500000,cost_configured=true,version=version+1 WHERE code='Life' AND NOT cost_configured;
UPDATE tpa.membership_plans SET cost_paise=2500000,cost_configured=true,version=version+1 WHERE code='Patron' AND NOT cost_configured;
ALTER TABLE tpa.memberships DROP CONSTRAINT memberships_type_check;
ALTER TABLE tpa.memberships ADD CONSTRAINT membership_plan_type FOREIGN KEY(type) REFERENCES tpa.membership_plans(code);
ALTER TABLE tpa.memberships DROP CONSTRAINT memberships_pending_plan_check;
ALTER TABLE tpa.memberships ADD CONSTRAINT membership_pending_plan FOREIGN KEY(pending_plan) REFERENCES tpa.membership_plans(code);
ALTER TABLE tpa.application_drafts DROP CONSTRAINT application_drafts_plan_check;
ALTER TABLE tpa.application_drafts ADD CONSTRAINT application_plan_type FOREIGN KEY(plan) REFERENCES tpa.membership_plans(code);
ALTER TABLE tpa.imported_membership_payments DROP CONSTRAINT imported_membership_payments_membership_plan_check;
ALTER TABLE tpa.imported_membership_payments ADD CONSTRAINT imported_payment_plan FOREIGN KEY(membership_plan) REFERENCES tpa.membership_plans(code);

CREATE TABLE tpa.event_participant_overrides (
 event_key text NOT NULL,
 identity text NOT NULL,
 data jsonb NOT NULL,
 version integer NOT NULL DEFAULT 1,
 updated_by text REFERENCES public."user"(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_key,identity)
);
CREATE TABLE tpa.event_sheet_imports (
 id uuid PRIMARY KEY,
 actor_id text REFERENCES public."user"(id) ON DELETE SET NULL,
 event_key text NOT NULL,
 mode text NOT NULL CHECK(mode IN ('registrations','attendance')),
 rows jsonb NOT NULL,
 baseline jsonb NOT NULL,
 committed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
