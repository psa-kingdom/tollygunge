-- CHECK must explicitly reject NULL contact fields for anonymous records.
ALTER TABLE tpa.inquiries ADD CONSTRAINT anonymous_contact_not_null CHECK(user_id IS NOT NULL OR (contact_name IS NOT NULL AND contact_email IS NOT NULL));
ALTER TABLE tpa.inquiries ADD CONSTRAINT public_intake_provenance CHECK(source='member' OR (contact_name IS NOT NULL AND contact_email IS NOT NULL AND consent_at IS NOT NULL AND submission_id IS NOT NULL AND submission_hash IS NOT NULL));
