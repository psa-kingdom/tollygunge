-- Additive member register. Abort rather than silently resolve identity collisions.
ALTER TABLE tpa.people ADD COLUMN contact_email TEXT;
ALTER TABLE tpa.people ADD COLUMN mobile_normalized TEXT;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public."user" GROUP BY lower(btrim(email)) HAVING count(*)>1) THEN
  RAISE EXCEPTION 'member_email_collision: run scripts/member-preflight.mts; no records were merged';
 END IF;
END $$;
UPDATE tpa.people p SET contact_email=lower(btrim(u.email)) FROM public."user" u WHERE u.id=p.user_id;
UPDATE tpa.people SET mobile_normalized=CASE
 WHEN regexp_replace(accepted->>'phone','[ ().-]','','g') ~ '^[6-9][0-9]{9}$' THEN '+91'||regexp_replace(accepted->>'phone','[ ().-]','','g')
 WHEN regexp_replace(accepted->>'phone','[ ().-]','','g') ~ '^\+[1-9][0-9]{7,14}$' THEN regexp_replace(accepted->>'phone','[ ().-]','','g')
 ELSE NULL END;
CREATE UNIQUE INDEX people_contact_email_unique ON tpa.people(lower(btrim(contact_email))) WHERE contact_email IS NOT NULL AND btrim(contact_email)<>'';
CREATE UNIQUE INDEX auth_email_normalized_unique ON public."user"(lower(btrim(email)));
CREATE INDEX people_mobile_lookup ON tpa.people(mobile_normalized) WHERE mobile_normalized IS NOT NULL;
ALTER TABLE tpa.people DROP CONSTRAINT people_user_id_fkey;
ALTER TABLE tpa.people ADD CONSTRAINT people_user_id_fkey FOREIGN KEY(user_id) REFERENCES public."user"(id) ON DELETE SET NULL;
CREATE TABLE tpa.memberships (
 id UUID PRIMARY KEY, person_id UUID NOT NULL UNIQUE REFERENCES tpa.people(id) ON DELETE RESTRICT,
 membership_number TEXT NOT NULL CHECK(length(btrim(membership_number)) BETWEEN 1 AND 80),
 type TEXT CHECK(type IN ('Annual','Life','Patron')), status TEXT CHECK(status IN ('active','expired','suspended','resigned')),
 valid_from DATE, valid_until DATE, source TEXT NOT NULL CHECK(source IN ('staff','import')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(valid_from IS NULL OR valid_until IS NULL OR valid_until>=valid_from)
);
CREATE UNIQUE INDEX memberships_number_unique ON tpa.memberships(lower(regexp_replace(btrim(membership_number),'\s+',' ','g')));
ALTER TABLE tpa.onboarding_batches ADD COLUMN mode TEXT NOT NULL DEFAULT 'accounts' CHECK(mode IN ('accounts','members'));
ALTER TABLE tpa.onboarding_batches ADD COLUMN choices JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tpa.onboarding_batches ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tpa.onboarding_batches ADD COLUMN source_hash TEXT;
ALTER TABLE tpa.onboarding_batches ADD COLUMN filename TEXT;
CREATE TABLE tpa.postal_versions (
 id TEXT PRIMARY KEY, source_url TEXT NOT NULL, source_sha256 TEXT NOT NULL,
 loaded_at TIMESTAMPTZ NOT NULL DEFAULT now(), active BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX postal_one_active ON tpa.postal_versions(active) WHERE active;
CREATE TABLE tpa.postal_locations (
 version_id TEXT NOT NULL REFERENCES tpa.postal_versions(id), pin TEXT NOT NULL CHECK(pin ~ '^[1-9][0-9]{5}$'),
 state TEXT NOT NULL, district TEXT NOT NULL, locality TEXT NOT NULL,
 PRIMARY KEY(version_id,pin,state,district,locality)
);
CREATE INDEX postal_hierarchy_lookup ON tpa.postal_locations(version_id,state,district);
CREATE TABLE tpa.postal_city_aliases (
 version_id TEXT NOT NULL REFERENCES tpa.postal_versions(id), state TEXT NOT NULL, district TEXT NOT NULL,
 alias TEXT NOT NULL, city TEXT NOT NULL, PRIMARY KEY(version_id,state,district,alias)
);
-- Preserve historical Student rows; prohibit new Student drafts or category changes to Student.
CREATE FUNCTION tpa.professional_application_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.category<>'Professional' AND (TG_OP='INSERT' OR NEW.category IS DISTINCT FROM OLD.category) THEN
  RAISE EXCEPTION 'Only Professional applications are supported' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER professional_application_write BEFORE INSERT OR UPDATE ON tpa.application_drafts FOR EACH ROW EXECUTE FUNCTION tpa.professional_application_write();
-- Publish a successor policy, never overwrite historical policies/submissions.
INSERT INTO tpa.verification_policies(version,fields)
SELECT version+1, coalesce((SELECT jsonb_agg((f || '{"categories":["Professional"]}'::jsonb)) FROM jsonb_array_elements(fields) f WHERE f->>'id'<>'studentEvidence' AND f->>'documentKind' IS DISTINCT FROM 'student_evidence'),'[]'::jsonb)
FROM tpa.verification_policies ORDER BY version DESC LIMIT 1;
UPDATE tpa.verification_policy_draft SET fields=coalesce((SELECT jsonb_agg(f || '{"categories":["Professional"]}'::jsonb) FROM jsonb_array_elements(fields) f WHERE f->>'id'<>'studentEvidence' AND f->>'documentKind' IS DISTINCT FROM 'student_evidence'),'[]'::jsonb),version=version+1;
