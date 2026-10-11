ALTER TABLE tpa.events
 ADD COLUMN registration_starts_at TIMESTAMPTZ,
 ADD COLUMN registration_ends_at TIMESTAMPTZ,
 ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','members')),
 ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'location' CHECK(delivery_mode IN ('location','online')),
 ADD COLUMN fee_paise INTEGER NOT NULL DEFAULT 0 CHECK(fee_paise BETWEEN 0 AND 100000000),
 ADD CONSTRAINT event_registration_window CHECK(registration_starts_at IS NULL OR registration_ends_at IS NULL OR registration_ends_at>registration_starts_at),
 ADD CONSTRAINT event_registration_deadline CHECK(registration_ends_at IS NULL OR registration_ends_at<=starts_at);
ALTER TABLE tpa.event_registrations
 ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'not_required' CHECK(payment_status IN ('not_required','pending','paid','failed','refunded','cancelled')),
 ADD COLUMN fee_paise INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN payment_reference TEXT NOT NULL DEFAULT '',
 ADD COLUMN payment_note TEXT NOT NULL DEFAULT '',
 ADD COLUMN payment_updated_by TEXT REFERENCES public."user"(id),
 ADD COLUMN payment_updated_at TIMESTAMPTZ,
 ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX registration_payment_attention ON tpa.event_registrations(payment_status) WHERE payment_status='pending';
