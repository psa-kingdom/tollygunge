ALTER TABLE tpa.people ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE tpa.content_entries ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE tpa.content_revisions DROP CONSTRAINT content_revisions_action_check;
ALTER TABLE tpa.content_revisions ADD CONSTRAINT content_revisions_action_check CHECK(action IN ('saved','published','unpublished','archive','restore'));
CREATE TABLE tpa.website_settings (
 key TEXT PRIMARY KEY CHECK(key IN ('shared','home')),
 draft JSONB NOT NULL, published JSONB, version INTEGER NOT NULL DEFAULT 1,
 updated_by TEXT NOT NULL REFERENCES public."user"(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.website_resources (
 id UUID PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('link','document')),
 draft JSONB NOT NULL, published JSONB, archived_at TIMESTAMPTZ,
 version INTEGER NOT NULL DEFAULT 1, updated_by TEXT NOT NULL REFERENCES public."user"(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.website_resource_files (
 id UUID PRIMARY KEY, resource_id UUID NOT NULL REFERENCES tpa.website_resources(id),
 original_name TEXT NOT NULL, byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),
 uploaded_by TEXT NOT NULL REFERENCES public."user"(id), uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.website_revisions (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, entity TEXT NOT NULL, version INTEGER NOT NULL,
 action TEXT NOT NULL, body JSONB, actor_id TEXT NOT NULL REFERENCES public."user"(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON tpa.website_resources(kind,archived_at);
-- Adopt the currently public professional links without changing their contents.
INSERT INTO tpa.website_resources(id,kind,draft,published,updated_by)
SELECT gen_random_uuid(),'link',jsonb_build_object('title',v.title,'description','','order',v.ord,'url',v.url,'fileId',NULL),jsonb_build_object('title',v.title,'description','','order',v.ord,'url',v.url,'fileId',NULL),a.user_id
FROM (VALUES
 ('Income Tax','https://www.incometax.gov.in/',0),('GST','https://www.gst.gov.in/',1),('MCA / ROC','https://www.mca.gov.in/',2),('ICAI','https://www.icai.org/',3),('ICSI','https://www.icsi.edu/',4),('RBI','https://www.rbi.org.in/',5),('SEBI','https://www.sebi.gov.in/',6),('EPFO','https://www.epfindia.gov.in/',7),('ESIC','https://www.esic.gov.in/',8),('DGFT','https://www.dgft.gov.in/',9),('Government Portals','https://www.india.gov.in/',10),('West Bengal Government','https://wb.gov.in/',11)
) v(title,url,ord) CROSS JOIN (SELECT user_id FROM tpa.staff_roles WHERE role='administrator' ORDER BY user_id LIMIT 1) a;
