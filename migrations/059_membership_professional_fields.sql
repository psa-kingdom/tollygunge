-- Preserve earlier submission policies and stored answers while revising the live form.
CREATE FUNCTION pg_temp.membership_professional_fields(fields jsonb) RETURNS jsonb
LANGUAGE sql AS $$
 SELECT coalesce(jsonb_agg(CASE WHEN f->>'id' IN ('professionalBody','registration')
   THEN f || '{"visible":false,"required":false,"regulated":false}'::jsonb ELSE f END ORDER BY ord),'[]'::jsonb)
   || '[{"id":"membershipNumber","label":"Membership No.","type":"text","step":0,"required":false,"visible":true,"categories":["Professional"],"maxLength":80},{"id":"designation","label":"Designation","type":"text","step":0,"required":false,"visible":true,"categories":["Professional"],"maxLength":120}]'::jsonb
 FROM jsonb_array_elements(fields) WITH ORDINALITY AS e(f,ord)
 WHERE f->>'id' NOT IN ('membershipNumber','designation');
$$;
WITH latest AS (SELECT version,fields FROM tpa.verification_policies ORDER BY version DESC LIMIT 1)
INSERT INTO tpa.verification_policies(version,fields)
SELECT version+1,pg_temp.membership_professional_fields(fields) FROM latest;
UPDATE tpa.verification_policy_draft
SET fields=pg_temp.membership_professional_fields(fields),version=version+1;
