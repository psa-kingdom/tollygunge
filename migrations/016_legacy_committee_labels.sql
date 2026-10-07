-- Preserve the original committee labels without inferring identities or verification.
UPDATE tpa.people p SET
 accepted = jsonb_set(p.accepted, '{assignments,0,label}', to_jsonb(g.draft->>'committee')),
 draft = jsonb_set(p.draft, '{assignments,0,label}', to_jsonb(g.draft->>'committee'))
FROM tpa.governance_profiles g
WHERE p.legacy_governance_id=g.id AND p.status='unverified'
 AND p.accepted=p.draft AND coalesce(g.draft->>'committee','')<>''
 AND jsonb_array_length(p.draft->'assignments')=1;
UPDATE tpa.people p SET published=jsonb_set(p.published, '{assignments,0,label}', to_jsonb(g.published->>'committee'))
FROM tpa.governance_profiles g
WHERE p.legacy_governance_id=g.id AND p.published IS NOT NULL
 AND NOT p.accepted_verified AND coalesce(g.published->>'committee','')<>''
 AND jsonb_array_length(p.published->'assignments')=1;
