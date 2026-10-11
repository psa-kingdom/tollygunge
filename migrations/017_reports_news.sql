CREATE TABLE tpa.report_presets (
 id UUID PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120), visibility TEXT NOT NULL CHECK(visibility IN ('private','shared')),
 report TEXT NOT NULL CHECK(report IN ('accounts','events','inquiries','content','newsletter')), filters JSONB NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_presets_owner ON tpa.report_presets(owner_user_id);
CREATE TABLE tpa.news_sources (
 id UUID PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 160), url TEXT NOT NULL CHECK(length(url) <= 1000),
 type TEXT NOT NULL CHECK(type IN ('website','rss')), notes TEXT NOT NULL CHECK(length(notes)<=3000),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','paused')), version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 updated_by TEXT NOT NULL REFERENCES public."user"(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.news_source_revisions (
 source_id UUID NOT NULL REFERENCES tpa.news_sources(id) ON DELETE CASCADE, version INTEGER NOT NULL,
 snapshot JSONB NOT NULL, action TEXT NOT NULL CHECK(action IN ('save','approve','pause')),
 actor_user_id TEXT NOT NULL REFERENCES public."user"(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(source_id,version)
);
