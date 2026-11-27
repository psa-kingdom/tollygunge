-- Retain entered application details while retiring unfinished legacy plans.
UPDATE tpa.application_drafts SET plan='Free',version=version+1,updated_at=now()
WHERE plan NOT IN ('Free','Patron','Life');

-- Foreign keys protect any historical member/payment records from deletion.
DELETE FROM tpa.membership_plans WHERE code NOT IN ('Free','Patron','Life');
UPDATE tpa.membership_plans SET active=true WHERE code IN ('Free','Patron','Life') AND NOT active;
ALTER TABLE tpa.membership_plans ADD CONSTRAINT three_membership_plans
CHECK(code IN ('Free','Patron','Life'));
