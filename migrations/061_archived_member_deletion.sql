ALTER TABLE tpa.people
  ADD COLUMN directory_deleted_at TIMESTAMPTZ,
  ADD CONSTRAINT people_deleted_records_stay_archived
    CHECK (directory_deleted_at IS NULL OR archived_at IS NOT NULL);
