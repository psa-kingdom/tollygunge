CREATE TABLE tpa.campaign_drafts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 3 AND 100),
  subject TEXT NOT NULL CHECK(length(subject) BETWEEN 3 AND 160 AND subject !~ E'[\\r\\n]'),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 10 AND 6000),
  audience JSONB NOT NULL CHECK(jsonb_typeof(audience)='object'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','archived')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  updated_by TEXT NOT NULL REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.campaign_revisions (
  campaign_id UUID NOT NULL REFERENCES tpa.campaign_drafts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK(version>0),
  snapshot JSONB NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
  actor_user_id TEXT NOT NULL REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(campaign_id,version)
);
CREATE INDEX ON tpa.campaign_drafts(status,updated_at DESC);
