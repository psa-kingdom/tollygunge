-- Additive: events remain canonical; legacy flyer templates are untouched.
CREATE TABLE tpa.flyer_variants (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_id UUID NOT NULL REFERENCES tpa.events(id),
 name TEXT NOT NULL, headline TEXT NOT NULL DEFAULT '', presentation JSONB NOT NULL DEFAULT '{"accent":"gold"}',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 version INTEGER NOT NULL DEFAULT 1, updated_by TEXT REFERENCES public."user"(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX flyer_variants_event ON tpa.flyer_variants(event_id);
CREATE TABLE tpa.event_promotion_settings (
 event_id UUID PRIMARY KEY REFERENCES tpa.events(id), version INTEGER NOT NULL DEFAULT 1,
 settings JSONB NOT NULL DEFAULT '{"registration_open":false,"capacity_pressure":false,"final_reminder":false,"upcoming":false,"capacityPercent":80,"finalMinutes":1440,"upcomingMinutes":1440}',
 updated_by TEXT REFERENCES public."user"(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 approved_version INTEGER, approved_event_version INTEGER, approved_at TIMESTAMPTZ
);
-- Promotions are campaign jobs so existing consent, unsubscribe, quotas and receipts apply.
ALTER TABLE tpa.email_dispatches ALTER COLUMN campaign_id DROP NOT NULL;
CREATE TABLE tpa.event_promotions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_id UUID NOT NULL REFERENCES tpa.events(id),
 kind TEXT NOT NULL CHECK(kind IN ('registration_open','capacity_pressure','final_reminder','upcoming')),
 event_version INTEGER NOT NULL, settings_version INTEGER NOT NULL,
 due_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 dispatch_id UUID NOT NULL REFERENCES tpa.email_dispatches(id),
 UNIQUE(event_id,kind,event_version,settings_version)
);
CREATE INDEX event_promotions_dispatch ON tpa.event_promotions(dispatch_id);
CREATE TABLE tpa.event_assets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_id UUID NOT NULL REFERENCES tpa.events(id),
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', type TEXT NOT NULL,
 content_type TEXT NOT NULL CHECK(content_type IN ('application/pdf','image/jpeg','image/png')),
 byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 eligibility TEXT NOT NULL CHECK(eligibility IN ('public','members','confirmed','attended','selected')),
 selected_members TEXT[] NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 1,
 uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by TEXT REFERENCES public."user"(id)
);
CREATE INDEX event_assets_event ON tpa.event_assets(event_id);
CREATE TABLE tpa.event_badge_rules (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 threshold INTEGER NOT NULL CHECK(threshold BETWEEN 1 AND 10000), icon TEXT NOT NULL CHECK(icon IN ('medal','star','trophy')),
 enabled BOOLEAN NOT NULL DEFAULT false, version INTEGER NOT NULL DEFAULT 1,
 updated_by TEXT REFERENCES public."user"(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO tpa.event_badge_rules(name,description,threshold,icon) VALUES
 ('First Event','Attend your first TPA event.',1,'medal'),
 ('Active Participant','Attend five TPA events.',5,'star'),
 ('Community Regular','Attend ten TPA events.',10,'trophy');
