ALTER TABLE tpa.memberships ALTER COLUMN membership_number DROP NOT NULL;

-- Preserve existing decisions and provision a membership for previously approved accounts.
INSERT INTO tpa.memberships(id,person_id,type,status,source)
SELECT gen_random_uuid(),p.id,u."requestedMembershipPlan",'active','staff'
FROM tpa.people p JOIN public."user" u ON u.id=p.user_id
WHERE p.accepted_verified AND p.archived_at IS NULL
ON CONFLICT(person_id) DO UPDATE
SET status=coalesce(tpa.memberships.status, excluded.status),
    type=coalesce(tpa.memberships.type, excluded.type),
    version=tpa.memberships.version+1,
    updated_at=now()
WHERE tpa.memberships.status IS NULL
   OR (tpa.memberships.type IS NULL AND excluded.type IS NOT NULL);
