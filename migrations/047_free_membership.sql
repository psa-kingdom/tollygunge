ALTER TABLE tpa.memberships DROP CONSTRAINT memberships_type_check;
ALTER TABLE tpa.memberships ADD CONSTRAINT memberships_type_check CHECK(type IN ('Free','Annual','Life','Patron'));
ALTER TABLE tpa.memberships DROP CONSTRAINT memberships_source_check;
ALTER TABLE tpa.memberships ADD CONSTRAINT memberships_source_check CHECK(source IN ('staff','import','signup'));
ALTER TABLE tpa.memberships ADD COLUMN pending_plan TEXT CHECK(pending_plan IN ('Free','Life','Patron'));

ALTER TABLE tpa.application_drafts DROP CONSTRAINT application_drafts_plan_check;
ALTER TABLE tpa.application_drafts ADD CONSTRAINT application_drafts_plan_check CHECK(plan IN ('Free','Annual','Life','Patron'));

ALTER TABLE public."user" ADD COLUMN "freeSignup" BOOLEAN NOT NULL DEFAULT false;

-- Provision the member record in the same transaction as account creation.
CREATE FUNCTION tpa.provision_free_signup() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  person_id UUID := gen_random_uuid();
  profile JSONB := jsonb_build_object('name', NEW.name);
BEGIN
  INSERT INTO tpa.people(id,user_id,accepted,draft,contact_email)
  VALUES(person_id,NEW.id,profile,profile,lower(btrim(NEW.email)));

  INSERT INTO tpa.memberships(id,person_id,type,status,source)
  VALUES(gen_random_uuid(),person_id,'Free','active','signup');

  RETURN NEW;
END $$;

CREATE TRIGGER provision_free_signup
AFTER INSERT ON public."user"
FOR EACH ROW WHEN (NEW."freeSignup")
EXECUTE FUNCTION tpa.provision_free_signup();
