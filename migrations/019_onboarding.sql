ALTER TABLE tpa.application_drafts ADD COLUMN step INTEGER NOT NULL DEFAULT 0 CHECK(step BETWEEN 0 AND 4);
ALTER TABLE tpa.application_drafts ADD COLUMN requirement_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tpa.people ADD COLUMN verification_version INTEGER;
ALTER TABLE tpa.people ADD COLUMN verification_update_requested BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE tpa.verification_policies(version INTEGER PRIMARY KEY, fields JSONB NOT NULL, published_at TIMESTAMPTZ NOT NULL DEFAULT now(), actor_id TEXT REFERENCES public."user"(id));
CREATE TABLE tpa.verification_policy_draft(id BOOLEAN PRIMARY KEY DEFAULT true CHECK(id), version INTEGER NOT NULL DEFAULT 0, fields JSONB NOT NULL);
CREATE TABLE tpa.verification_submissions(id UUID PRIMARY KEY, user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE, person_id UUID NOT NULL REFERENCES tpa.people(id) ON DELETE CASCADE, requirement_version INTEGER NOT NULL REFERENCES tpa.verification_policies(version), snapshot JSONB NOT NULL, person_snapshot JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','corrections','superseded')), reason TEXT NOT NULL DEFAULT '', reviewed_by TEXT REFERENCES public."user"(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), reviewed_at TIMESTAMPTZ, version INTEGER NOT NULL DEFAULT 1);
CREATE UNIQUE INDEX ON tpa.verification_submissions(user_id) WHERE status='pending';
CREATE TABLE tpa.onboarding_mail(id UUID PRIMARY KEY, dedupe TEXT UNIQUE NOT NULL, user_id TEXT REFERENCES public."user"(id) ON DELETE CASCADE, recipient TEXT NOT NULL, kind TEXT NOT NULL, payload JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','leased','accepted','delivered','bounced','failed')), attempts INTEGER NOT NULL DEFAULT 0, available_at TIMESTAMPTZ NOT NULL DEFAULT now(), lease_until TIMESTAMPTZ, first_attempt_at TIMESTAMPTZ, reason TEXT, provider_id TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE tpa.onboarding_mail_events(id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, type TEXT NOT NULL);
CREATE TABLE tpa.onboarding_settings(id BOOLEAN PRIMARY KEY DEFAULT true CHECK(id), version INTEGER NOT NULL DEFAULT 1, test_recipients JSONB NOT NULL DEFAULT '["savagesnowboy@gmail.com"]');
INSERT INTO tpa.onboarding_settings(id) VALUES(true);
CREATE TABLE tpa.onboarding_batches(id UUID PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES public."user"(id), rows JSONB NOT NULL, committed_at TIMESTAMPTZ, results JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE tpa.onboarding_invitations(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, redeemed_at TIMESTAMPTZ);
CREATE TABLE tpa.onboarding_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, starts_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public."session" ADD COLUMN "durationDays" INTEGER NOT NULL DEFAULT 7 CHECK("durationDays" IN (7,30));

CREATE TABLE public."rateLimit" ("id" TEXT PRIMARY KEY, "key" TEXT UNIQUE NOT NULL, "count" INTEGER NOT NULL, "lastRequest" BIGINT NOT NULL);

-- Carry forward legacy answers without deleting their original keys.
UPDATE tpa.application_drafts SET details=details || jsonb_build_object(
  'organization',coalesce(nullif(details->>'organization',''),details->>'institution',''),
  'residenceAddress',coalesce(nullif(details->>'residenceAddress',''),details->>'address',''),
  'correspondenceAddress',coalesce(nullif(details->>'correspondenceAddress',''),CASE WHEN coalesce(details->>'address','')<>'' THEN 'Residence' ELSE '' END)
);
WITH evidence AS (
 SELECT DISTINCT ON (a.application_id,d.kind) a.application_id,d.kind,d.id
 FROM tpa.application_documents a JOIN tpa.private_documents d ON d.id=a.document_id
 JOIN tpa.application_drafts f ON f.id=a.application_id AND f.user_id=d.owner_user_id
 ORDER BY a.application_id,d.kind,d.created_at DESC,d.id
), mapped AS (
 SELECT application_id,jsonb_object_agg(CASE kind WHEN 'student_evidence' THEN 'studentEvidence' ELSE kind END,id::text) AS answers
 FROM evidence GROUP BY application_id
)
UPDATE tpa.application_drafts a SET details=m.answers || a.details FROM mapped m WHERE a.id=m.application_id;
CREATE INDEX ON tpa.onboarding_mail(status,available_at) WHERE status IN ('queued','leased');
CREATE INDEX ON tpa.verification_submissions(person_id,reviewed_at DESC) WHERE status='approved';
