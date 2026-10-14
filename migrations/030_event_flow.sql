ALTER TABLE tpa.events
  ADD COLUMN speakers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(speakers)='array' AND jsonb_array_length(speakers)<=6),
  ADD COLUMN reminders JSONB NOT NULL DEFAULT '{"enabled":false,"offsets":[1440,60],"includePending":false}'::jsonb,
  ADD COLUMN schedule_revision INTEGER NOT NULL DEFAULT 1;
UPDATE tpa.events e SET speakers=t.speakers FROM tpa.flyer_templates t WHERE t.event_id=e.id;
ALTER TABLE tpa.event_registrations ADD COLUMN booking_revision INTEGER NOT NULL DEFAULT 1;
CREATE TABLE tpa.event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES tpa.events(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES tpa.event_registrations(id) ON DELETE CASCADE,
  schedule_revision INTEGER NOT NULL,
  booking_revision INTEGER NOT NULL,
  offset_minutes INTEGER NOT NULL CHECK(offset_minutes BETWEEN 15 AND 10080),
  audience TEXT NOT NULL CHECK(audience IN ('confirmed','pending')),
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','queued','skipped')),
  reason TEXT,
  mail_id UUID REFERENCES tpa.onboarding_mail(id) ON DELETE SET NULL,
  UNIQUE(registration_id,booking_revision,schedule_revision,offset_minutes,audience)
);
CREATE INDEX event_reminder_due ON tpa.event_reminders(due_at) WHERE status='scheduled';
ALTER TABLE tpa.onboarding_mail ADD COLUMN event_id UUID REFERENCES tpa.events(id) ON DELETE CASCADE,
  ADD COLUMN registration_id UUID REFERENCES tpa.event_registrations(id) ON DELETE CASCADE;
CREATE TABLE tpa.event_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES tpa.event_registrations(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  fee_paise INTEGER NOT NULL,
  previous_reference TEXT NOT NULL DEFAULT '',
  previous_note TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL,
  note TEXT NOT NULL,
  actor_id TEXT REFERENCES public."user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO tpa.event_payment_history(registration_id,to_status,fee_paise,reference,note,actor_id,created_at)
  SELECT id,payment_status,fee_paise,payment_reference,payment_note,payment_updated_by,coalesce(payment_updated_at,registered_at)
  FROM tpa.event_registrations WHERE fee_paise>0;
CREATE INDEX event_payment_history_registration ON tpa.event_payment_history(registration_id,created_at);
