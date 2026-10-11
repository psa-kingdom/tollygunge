-- Editorial publication approval never confers professional/member verification.
ALTER TABLE tpa.people ADD COLUMN editorial_approved_snapshot JSONB
 CHECK(editorial_approved_snapshot IS NULL OR jsonb_typeof(editorial_approved_snapshot)='object');
