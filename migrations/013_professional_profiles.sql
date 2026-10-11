ALTER TABLE tpa.member_profiles
  ADD COLUMN profession TEXT NOT NULL DEFAULT '' CHECK (length(profession)<=120),
  ADD COLUMN job_title TEXT NOT NULL DEFAULT '' CHECK (length(job_title)<=120),
  ADD COLUMN city TEXT NOT NULL DEFAULT '' CHECK (length(city)<=120);
