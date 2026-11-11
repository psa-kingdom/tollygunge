-- Publish a successor policy. Preserve earlier submission snapshots and title answers.
WITH latest AS (SELECT version, fields FROM tpa.verification_policies ORDER BY version DESC LIMIT 1), revised AS (
 SELECT version, (SELECT jsonb_agg(CASE
 WHEN f->>'id'='title' THEN f || '{"visible":false,"required":false}'::jsonb
 WHEN f->>'id'='signature' THEN f || '{"visible":false,"required":false}'::jsonb
 WHEN f->>'id'='photograph' THEN f || '{"label":"Recent photograph","step":1}'::jsonb
 ELSE f END ORDER BY ord) FROM jsonb_array_elements(fields) WITH ORDINALITY AS e(f,ord)
 WHERE f->>'id' NOT IN ('gender','signatureDocument')) ||
 '[{"id":"gender","label":"Gender","type":"select","step":1,"required":false,"visible":true,"categories":["Professional"],"options":["Male","Female","Transgender"]},{"id":"signatureDocument","label":"Applicant signature or signed form","type":"document","documentKind":"supporting","step":4,"required":true,"visible":true,"categories":["Professional"]}]'::jsonb AS fields FROM latest
)
INSERT INTO tpa.verification_policies(version,fields) SELECT version+1,fields FROM revised;
-- Keep unpublished custom fields while updating the required built-in fields.
UPDATE tpa.verification_policy_draft SET fields=(SELECT jsonb_agg(CASE
 WHEN f->>'id' IN ('title','signature') THEN f || '{"visible":false,"required":false}'::jsonb
 WHEN f->>'id'='photograph' THEN f || '{"label":"Recent photograph","step":1}'::jsonb
 ELSE f END ORDER BY ord) FROM jsonb_array_elements(fields) WITH ORDINALITY AS e(f,ord)
 WHERE f->>'id' NOT IN ('gender','signatureDocument')) ||
 '[{"id":"gender","label":"Gender","type":"select","step":1,"required":false,"visible":true,"categories":["Professional"],"options":["Male","Female","Transgender"]},{"id":"signatureDocument","label":"Applicant signature or signed form","type":"document","documentKind":"supporting","step":4,"required":true,"visible":true,"categories":["Professional"]}]'::jsonb, version=version+1;
