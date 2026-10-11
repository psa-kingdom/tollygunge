CREATE TABLE tpa.flyer_templates (
  event_id UUID PRIMARY KEY REFERENCES tpa.events(id),
  speakers JSONB NOT NULL CHECK(jsonb_typeof(speakers)='array' AND jsonb_array_length(speakers) BETWEEN 1 AND 2),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES public."user"(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.communication_templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 3 AND 100),
  subject TEXT NOT NULL CHECK(length(subject) BETWEEN 3 AND 160),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 10 AND 6000),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES public."user"(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
