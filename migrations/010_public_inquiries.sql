-- Keep anonymous contacts separate from authentication identities and newsletter consent.
ALTER TABLE tpa.inquiries ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE tpa.inquiries DROP CONSTRAINT inquiries_status_check;
ALTER TABLE tpa.inquiries ALTER COLUMN status SET DEFAULT 'new';
UPDATE tpa.inquiries SET status=CASE status WHEN 'open' THEN 'new' WHEN 'in_progress' THEN 'contacted' ELSE 'closed' END;
ALTER TABLE tpa.inquiries ADD CONSTRAINT inquiries_status_check CHECK(status IN ('new','contacted','closed'));
ALTER TABLE tpa.inquiries ADD COLUMN contact_name TEXT;
ALTER TABLE tpa.inquiries ADD COLUMN contact_email TEXT;
ALTER TABLE tpa.inquiries ADD COLUMN phone TEXT NOT NULL DEFAULT '' CHECK(length(phone)<=30);
ALTER TABLE tpa.inquiries ADD COLUMN organization TEXT NOT NULL DEFAULT '' CHECK(length(organization)<=160);
ALTER TABLE tpa.inquiries ADD COLUMN job_title TEXT NOT NULL DEFAULT '' CHECK(length(job_title)<=120);
ALTER TABLE tpa.inquiries ADD COLUMN location TEXT NOT NULL DEFAULT '' CHECK(length(location)<=120);
ALTER TABLE tpa.inquiries ADD COLUMN topic TEXT NOT NULL DEFAULT 'General' CHECK(topic IN ('General','Membership','Events','Partnership','Professional collaboration'));
ALTER TABLE tpa.inquiries ADD COLUMN contact_preference TEXT NOT NULL DEFAULT 'email' CHECK(contact_preference IN ('email','phone'));
ALTER TABLE tpa.inquiries ADD COLUMN consent_at TIMESTAMPTZ;
ALTER TABLE tpa.inquiries ADD COLUMN source TEXT NOT NULL DEFAULT 'member' CHECK(source IN ('member','homepage','contact'));
ALTER TABLE tpa.inquiries ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}' CHECK(cardinality(tags)<=8);
ALTER TABLE tpa.inquiries ADD COLUMN submission_id UUID UNIQUE;
ALTER TABLE tpa.inquiries ADD COLUMN submission_hash TEXT;
ALTER TABLE tpa.inquiries ADD CONSTRAINT inquiry_contact_required CHECK(user_id IS NOT NULL OR (length(contact_name) BETWEEN 2 AND 120 AND length(contact_email) BETWEEN 3 AND 254 AND consent_at IS NOT NULL));
CREATE INDEX ON tpa.inquiries(status,created_at DESC);
CREATE INDEX ON tpa.inquiries(contact_email,created_at DESC);
CREATE INDEX ON tpa.inquiries USING GIN(tags);
ALTER TABLE tpa.audit_events ALTER COLUMN actor_user_id DROP NOT NULL;
ALTER TABLE tpa.audit_events ADD CONSTRAINT audit_actor_required CHECK(actor_user_id IS NOT NULL OR action='inquiry.public_created');
CREATE TABLE tpa.inquiry_updates (
  inquiry_id UUID NOT NULL REFERENCES tpa.inquiries(id),
  version INTEGER NOT NULL CHECK(version>0),
  actor_id TEXT NOT NULL REFERENCES public."user"(id),
  status TEXT NOT NULL CHECK(status IN ('new','contacted','closed')),
  assigned_to TEXT REFERENCES public."user"(id),
  follow_up_at TIMESTAMPTZ,
  tags TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(inquiry_id,version)
);
