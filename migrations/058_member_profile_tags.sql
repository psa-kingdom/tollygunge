CREATE TABLE tpa.member_profile_tags (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60 AND name = btrim(name))
);
CREATE UNIQUE INDEX member_profile_tags_name_unique ON tpa.member_profile_tags (lower(name));

CREATE TABLE tpa.member_profile_tag_assignments (
  tag_id UUID NOT NULL REFERENCES tpa.member_profile_tags(id) ON DELETE CASCADE,
  person_id UUID REFERENCES tpa.people(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public."user"(id) ON DELETE CASCADE,
  CHECK (num_nonnulls(person_id, user_id) = 1)
);
CREATE UNIQUE INDEX member_profile_tag_person_unique ON tpa.member_profile_tag_assignments (person_id, tag_id) WHERE person_id IS NOT NULL;
CREATE UNIQUE INDEX member_profile_tag_user_unique ON tpa.member_profile_tag_assignments (user_id, tag_id) WHERE user_id IS NOT NULL;
CREATE INDEX member_profile_tag_assignments_tag ON tpa.member_profile_tag_assignments (tag_id);
