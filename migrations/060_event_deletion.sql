ALTER TABLE tpa.events ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE tpa.historical_event_details ADD COLUMN deleted_at TIMESTAMPTZ;
