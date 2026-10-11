ALTER TABLE tpa.staff_roles ADD CONSTRAINT staff_auth_user_fk
  FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;
ALTER TABLE tpa.private_documents ADD CONSTRAINT documents_auth_user_fk
  FOREIGN KEY (owner_user_id) REFERENCES public."user"(id) ON DELETE RESTRICT;
ALTER TABLE tpa.audit_events ADD CONSTRAINT audit_auth_user_fk
  FOREIGN KEY (actor_user_id) REFERENCES public."user"(id) ON DELETE RESTRICT;

-- A profile is not an approved membership. Membership activation is a later workflow.
CREATE TABLE tpa.member_profiles (
  user_id TEXT PRIMARY KEY REFERENCES public."user"(id) ON DELETE RESTRICT,
  phone TEXT NOT NULL DEFAULT '' CHECK (length(phone) <= 32),
  organization TEXT NOT NULL DEFAULT '' CHECK (length(organization) <= 200),
  preferences JSONB NOT NULL DEFAULT '{"contact":"email"}'::jsonb CHECK (jsonb_typeof(preferences)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tpa.newsletter_consents (
  user_id TEXT PRIMARY KEY REFERENCES public."user"(id) ON DELETE RESTRICT,
  subscribed BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
