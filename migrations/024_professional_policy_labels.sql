-- A new published version carries Professional-only wording/options. Historical versions stay immutable.
WITH latest AS (SELECT * FROM tpa.verification_policies ORDER BY version DESC LIMIT 1), transformed AS (
 SELECT version,fields,(SELECT jsonb_agg(CASE
  WHEN f->>'id'='qualification' AND f->>'label'='Qualification / course' THEN f || '{"label":"Qualification"}'::jsonb
  WHEN f->>'id'='organization' AND f->>'label'='Organisation / institution' THEN f || '{"label":"Organisation"}'::jsonb
  WHEN f->>'id'='title' THEN f || '{"options":["Mr","Mrs","Miss","Ms","Dr","Prof","CA","CS","CMA","Adv","Other"]}'::jsonb
  ELSE f END) FROM jsonb_array_elements(fields) f) AS new_fields FROM latest
)
INSERT INTO tpa.verification_policies(version,fields) SELECT version+1,new_fields FROM transformed WHERE new_fields IS DISTINCT FROM fields;
UPDATE tpa.verification_policy_draft SET fields=(SELECT jsonb_agg(CASE
 WHEN f->>'id'='qualification' AND f->>'label'='Qualification / course' THEN f || '{"label":"Qualification"}'::jsonb
 WHEN f->>'id'='organization' AND f->>'label'='Organisation / institution' THEN f || '{"label":"Organisation"}'::jsonb
 WHEN f->>'id'='title' THEN f || '{"options":["Mr","Mrs","Miss","Ms","Dr","Prof","CA","CS","CMA","Adv","Other"]}'::jsonb
 ELSE f END) FROM jsonb_array_elements(fields) f),version=version+1;
