CREATE TABLE tpa.email_dispatches (
 id UUID PRIMARY KEY, campaign_id UUID NOT NULL REFERENCES tpa.campaign_drafts(id),
 campaign_version INTEGER NOT NULL, snapshot JSONB NOT NULL,
 created_by TEXT NOT NULL REFERENCES public."user"(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 cancelled_at TIMESTAMPTZ, version INTEGER NOT NULL DEFAULT 1,
 UNIQUE(campaign_id,campaign_version)
);
CREATE TABLE tpa.email_conversations (
 id UUID PRIMARY KEY, subject TEXT NOT NULL CHECK(length(subject)<=500),
 correspondent TEXT NOT NULL, reply_to TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','closed')),
 unread BOOLEAN NOT NULL DEFAULT true, archived BOOLEAN NOT NULL DEFAULT false,
 assigned_to TEXT REFERENCES public."user"(id), inquiry_id UUID REFERENCES tpa.inquiries(id),
 draft TEXT NOT NULL DEFAULT '' CHECK(length(draft)<=6000), draft_version INTEGER NOT NULL DEFAULT 1,
 version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.email_messages (
 id UUID PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES tpa.email_conversations(id),
 provider_id TEXT UNIQUE, message_id TEXT, parent_message_id TEXT,
 direction TEXT NOT NULL CHECK(direction IN ('incoming','outgoing')),
 sender TEXT NOT NULL, recipient TEXT NOT NULL, body TEXT NOT NULL CHECK(length(body)<=100000),
 attachments JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON tpa.email_messages(message_id);
CREATE TABLE tpa.email_notes (
 id UUID PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES tpa.email_conversations(id),
 actor_id TEXT NOT NULL REFERENCES public."user"(id), body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.email_unsubscribe_tokens (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES public."user"(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.email_jobs (
 id UUID PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('campaign','reply','inbound')),
 dispatch_id UUID REFERENCES tpa.email_dispatches(id), user_id TEXT REFERENCES public."user"(id),
 conversation_id UUID REFERENCES tpa.email_conversations(id), draft_version INTEGER,
 created_by TEXT REFERENCES public."user"(id),
 recipient TEXT, payload JSONB NOT NULL CHECK(jsonb_typeof(payload)='object'),
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','leased','accepted','skipped','failed','review','cancelled')),
 reason TEXT, provider_id TEXT UNIQUE, attempts INTEGER NOT NULL DEFAULT 0,
 first_attempt_at TIMESTAMPTZ, lease_owner TEXT, lease_until TIMESTAMPTZ,
 provider_request JSONB,
 available_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(attempts>=0),
 CHECK((kind='campaign' AND dispatch_id IS NOT NULL AND user_id IS NOT NULL AND recipient IS NOT NULL AND created_by IS NOT NULL) OR (kind='reply' AND conversation_id IS NOT NULL AND draft_version IS NOT NULL AND recipient IS NOT NULL AND created_by IS NOT NULL) OR (kind='inbound' AND payload ? 'emailId')),
 UNIQUE(dispatch_id,user_id), UNIQUE(conversation_id,draft_version)
);
CREATE INDEX ON tpa.email_jobs(status,available_at);
CREATE UNIQUE INDEX ON tpa.email_jobs((payload->>'emailId')) WHERE kind='inbound';
CREATE TABLE tpa.email_events (
 event_id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, type TEXT NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON tpa.email_events(provider_id,occurred_at);
CREATE TABLE tpa.email_suppressions (
 email TEXT PRIMARY KEY, reason TEXT NOT NULL CHECK(reason IN ('bounce','complaint','suppressed','permanent_failure')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.email_receipts (
 provider_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES public."user"(id),
 kind TEXT NOT NULL CHECK(kind='recovery'), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.email_worker_state (
 id TEXT PRIMARY KEY CHECK(id='email'), heartbeat_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL, quota JSONB, quota_checked_at TIMESTAMPTZ
);
ALTER TABLE tpa.audit_events DROP CONSTRAINT audit_actor_required;
ALTER TABLE tpa.audit_events ADD CONSTRAINT audit_actor_required CHECK(actor_user_id IS NOT NULL OR action IN ('inquiry.public_created','newsletter.email_unsubscribed'));
