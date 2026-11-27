ALTER TABLE tpa.people
  ADD COLUMN publishing_deleted_at TIMESTAMPTZ,
  ADD CONSTRAINT people_deleted_profiles_stay_private
    CHECK (publishing_deleted_at IS NULL OR published IS NULL);

ALTER TABLE tpa.content_entries
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD CONSTRAINT deleted_articles_stay_archived
    CHECK (deleted_at IS NULL OR (kind IN ('insight','news') AND archived_at IS NOT NULL AND published IS NULL)),
  DROP CONSTRAINT content_entries_slug_key;
CREATE UNIQUE INDEX content_entries_available_slug ON tpa.content_entries(slug) WHERE deleted_at IS NULL;

ALTER TABLE tpa.content_revisions DROP CONSTRAINT content_revisions_action_check;
ALTER TABLE tpa.content_revisions ADD CONSTRAINT content_revisions_action_check
  CHECK (action IN ('saved','published','unpublished','archive','restore','delete'));
