-- Public newsletter consent is independent of accounts and membership.
CREATE TABLE tpa.public_subscribers (
 id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE CHECK(email=lower(btrim(email))),
 status TEXT NOT NULL CHECK(status IN ('pending','confirmed','unsubscribed')),
 consent_version TEXT NOT NULL, requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 confirmed_at TIMESTAMPTZ, unsubscribed_at TIMESTAMPTZ,
 version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.public_subscription_tokens (
 token_hash TEXT PRIMARY KEY, subscriber_id UUID NOT NULL REFERENCES tpa.public_subscribers(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('confirm','unsubscribe')),
 subscriber_version INTEGER NOT NULL, expires_at TIMESTAMPTZ, used_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.public_subscription_requests (
 email TEXT NOT NULL, requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX public_subscription_request_time ON tpa.public_subscription_requests(requested_at);
CREATE INDEX public_subscription_request_email ON tpa.public_subscription_requests(email,requested_at);
ALTER TABLE tpa.email_jobs ADD COLUMN subscriber_id UUID REFERENCES tpa.public_subscribers(id);
ALTER TABLE tpa.email_jobs DROP CONSTRAINT email_jobs_kind_check;
ALTER TABLE tpa.email_jobs ADD CONSTRAINT email_jobs_kind_check CHECK(kind IN ('campaign','reply','inbound','subscription_confirmation'));
ALTER TABLE tpa.email_jobs DROP CONSTRAINT email_jobs_check;
ALTER TABLE tpa.email_jobs ADD CONSTRAINT email_jobs_recipient_check CHECK(
 (kind='campaign' AND dispatch_id IS NOT NULL AND recipient IS NOT NULL AND created_by IS NOT NULL AND ((user_id IS NOT NULL AND subscriber_id IS NULL) OR (user_id IS NULL AND subscriber_id IS NOT NULL))) OR
 (kind='reply' AND conversation_id IS NOT NULL AND draft_version IS NOT NULL AND recipient IS NOT NULL AND created_by IS NOT NULL AND subscriber_id IS NULL) OR
 (kind='inbound' AND payload ? 'emailId' AND subscriber_id IS NULL) OR
 (kind='subscription_confirmation' AND subscriber_id IS NOT NULL AND user_id IS NULL AND recipient IS NOT NULL AND dispatch_id IS NULL AND created_by IS NULL)
);
CREATE UNIQUE INDEX email_jobs_dispatch_subscriber ON tpa.email_jobs(dispatch_id,subscriber_id) WHERE subscriber_id IS NOT NULL;
