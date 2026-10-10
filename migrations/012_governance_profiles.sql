-- Public association profiles confer neither membership nor staff privileges.
CREATE TABLE tpa.governance_profiles (
  id UUID PRIMARY KEY,
  draft JSONB NOT NULL CHECK(jsonb_typeof(draft)='object'),
  published JSONB CHECK(published IS NULL OR jsonb_typeof(published)='object'),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  updated_by TEXT NOT NULL REFERENCES public."user"(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  draft_portrait_id UUID GENERATED ALWAYS AS ((draft->>'portraitId')::uuid) STORED REFERENCES tpa.public_media(id),
  published_portrait_id UUID GENERATED ALWAYS AS ((published->>'portraitId')::uuid) STORED REFERENCES tpa.public_media(id)
);
CREATE TABLE tpa.governance_revisions (
  profile_id UUID NOT NULL REFERENCES tpa.governance_profiles(id),
  version INTEGER NOT NULL CHECK(version>0),
  action TEXT NOT NULL CHECK(action IN ('saved','published','unpublished')),
  body JSONB NOT NULL,
  actor_id TEXT NOT NULL REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  portrait_id UUID GENERATED ALWAYS AS ((body->>'portraitId')::uuid) STORED REFERENCES tpa.public_media(id),
  PRIMARY KEY(profile_id,version)
);
