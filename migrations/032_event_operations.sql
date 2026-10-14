ALTER TABLE tpa.events
 ADD COLUMN booking_closed BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN completed_at TIMESTAMPTZ,
 ADD COLUMN archived_at TIMESTAMPTZ,
 ADD COLUMN attendance_finalized_at TIMESTAMPTZ,
 ADD COLUMN financial_reviewed_at TIMESTAMPTZ,
 ADD COLUMN payment_account_ids UUID[],
 ADD COLUMN payment_revision INTEGER;
CREATE TABLE tpa.event_payment_configurations (
 event_id UUID NOT NULL REFERENCES tpa.events(id),
 revision INTEGER NOT NULL CHECK(revision>0),
 accounts JSONB NOT NULL CHECK(jsonb_typeof(accounts)='array'),
 actor_id TEXT NOT NULL REFERENCES public."user"(id),
 reason TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,revision)
);
ALTER TABLE tpa.event_registrations ADD COLUMN payment_revision INTEGER;
ALTER TABLE tpa.event_registrations ADD FOREIGN KEY(event_id,payment_revision) REFERENCES tpa.event_payment_configurations(event_id,revision);
ALTER TABLE tpa.events ADD FOREIGN KEY(id,payment_revision) REFERENCES tpa.event_payment_configurations(event_id,revision);
CREATE TABLE tpa.event_booking_payment_configurations (
 registration_id UUID NOT NULL REFERENCES tpa.event_registrations(id),
 booking_revision INTEGER NOT NULL,
 event_id UUID NOT NULL REFERENCES tpa.events(id),
 payment_revision INTEGER,
 fee_paise INTEGER NOT NULL CHECK(fee_paise>=0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(registration_id,booking_revision),
 FOREIGN KEY(event_id,payment_revision) REFERENCES tpa.event_payment_configurations(event_id,revision)
);
INSERT INTO tpa.event_booking_payment_configurations(registration_id,booking_revision,event_id,fee_paise,created_at)
 SELECT id,booking_revision,event_id,fee_paise,registered_at FROM tpa.event_registrations;
CREATE TABLE tpa.event_operation_history (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id UUID NOT NULL REFERENCES tpa.events(id),
 actor_id TEXT NOT NULL REFERENCES public."user"(id),
 action TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE tpa.event_attendance ADD COLUMN outcome TEXT NOT NULL DEFAULT 'attended' CHECK(outcome IN ('attended','absent','unmarked')),
 ADD COLUMN version INTEGER NOT NULL DEFAULT 1, ADD COLUMN note TEXT NOT NULL DEFAULT '';
CREATE TABLE tpa.event_badges (
 registration_id UUID PRIMARY KEY REFERENCES tpa.event_registrations(id),
 awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ
);
ALTER TABLE tpa.event_assets ADD COLUMN url TEXT;
ALTER TABLE tpa.event_assets ALTER COLUMN content_type DROP NOT NULL;
ALTER TABLE tpa.event_assets ALTER COLUMN byte_size DROP NOT NULL;
ALTER TABLE tpa.event_assets DROP CONSTRAINT event_assets_eligibility_check;
ALTER TABLE tpa.event_assets ADD CHECK(eligibility IN ('public','members','confirmed','attended','selected','finance'));
ALTER TABLE tpa.event_assets ADD CHECK((url IS NULL AND content_type IS NOT NULL AND byte_size IS NOT NULL) OR (url IS NOT NULL AND url LIKE 'https://%' AND content_type IS NULL AND byte_size IS NULL));
CREATE TABLE tpa.event_expenses (
 id UUID PRIMARY KEY, event_id UUID NOT NULL REFERENCES tpa.events(id),
 category TEXT NOT NULL CHECK(category IN ('venue','catering','speaker','travel','accommodation','printing','marketing','equipment','miscellaneous')),
 description TEXT NOT NULL CHECK(length(description) BETWEEN 3 AND 1000),
 amount_paise INTEGER NOT NULL CHECK(amount_paise>0), expense_date DATE NOT NULL,
 vendor TEXT NOT NULL DEFAULT '', method TEXT NOT NULL DEFAULT '', account_snapshot JSONB,
 notes TEXT NOT NULL DEFAULT '', receipt_id UUID REFERENCES tpa.event_assets(id),
 version INTEGER NOT NULL DEFAULT 1, voided_at TIMESTAMPTZ,
 updated_by TEXT NOT NULL REFERENCES public."user"(id)
);
CREATE TABLE tpa.event_entitlements (
 id UUID PRIMARY KEY, registration_id UUID NOT NULL REFERENCES tpa.event_registrations(id),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 160), notes TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1, revoked_at TIMESTAMPTZ,
 granted_by TEXT NOT NULL REFERENCES public."user"(id), granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.event_announcements (
 id UUID PRIMARY KEY, event_id UUID NOT NULL REFERENCES tpa.events(id),
 subject TEXT NOT NULL CHECK(length(subject) BETWEEN 3 AND 160), body TEXT NOT NULL CHECK(length(body) BETWEEN 3 AND 4000),
 version INTEGER NOT NULL DEFAULT 1, sent_at TIMESTAMPTZ, created_by TEXT NOT NULL REFERENCES public."user"(id)
);

CREATE INDEX ON tpa.event_expenses(event_id);
CREATE INDEX ON tpa.event_operation_history(event_id,created_at);
