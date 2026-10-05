CREATE TABLE tpa.content_entries (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind TEXT NOT NULL CHECK (kind IN ('page','insight','news')),
  draft JSONB NOT NULL CHECK (jsonb_typeof(draft)='object'),
  published JSONB CHECK (jsonb_typeof(published)='object'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version>0),
  updated_by TEXT NOT NULL REFERENCES public."user"(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE TABLE tpa.content_revisions (
  entry_id UUID NOT NULL REFERENCES tpa.content_entries(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body JSONB NOT NULL,
  actor_id TEXT NOT NULL REFERENCES public."user"(id),
  action TEXT NOT NULL CHECK (action IN ('saved','published','unpublished')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(entry_id,version)
);
CREATE TABLE tpa.application_drafts (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES public."user"(id),
  plan TEXT NOT NULL CHECK(plan IN ('Annual','Life','Patron')),
  category TEXT NOT NULL CHECK(category IN ('Professional','Student')),
  details JSONB NOT NULL CHECK(jsonb_typeof(details)='object'),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.application_documents (
  application_id UUID NOT NULL REFERENCES tpa.application_drafts(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES tpa.private_documents(id),
  PRIMARY KEY(application_id,document_id)
);
CREATE TABLE tpa.events (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 160),
  description TEXT NOT NULL CHECK(length(description)<=6000),
  location TEXT NOT NULL CHECK(length(location)<=200),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL CHECK(ends_at>starts_at),
  capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 10000),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','cancelled')),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.event_registrations (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES tpa.events(id),
  user_id TEXT NOT NULL REFERENCES public."user"(id),
  status TEXT NOT NULL CHECK(status IN ('registered','cancelled')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id,user_id)
);
CREATE INDEX ON tpa.event_registrations(event_id,status);
CREATE TABLE tpa.event_attendance (
  registration_id UUID PRIMARY KEY REFERENCES tpa.event_registrations(id),
  checked_in_by TEXT NOT NULL REFERENCES public."user"(id),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Attendance alone does not generate learning hours. Rule approval is a later gate.
CREATE TABLE tpa.inquiries (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public."user"(id),
  subject TEXT NOT NULL CHECK(length(subject) BETWEEN 3 AND 160),
  message TEXT NOT NULL CHECK(length(message) BETWEEN 10 AND 4000),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved')),
  assigned_to TEXT REFERENCES public."user"(id),
  follow_up_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.inquiry_notes (
  id UUID PRIMARY KEY,
  inquiry_id UUID NOT NULL REFERENCES tpa.inquiries(id),
  actor_id TEXT NOT NULL REFERENCES public."user"(id),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
