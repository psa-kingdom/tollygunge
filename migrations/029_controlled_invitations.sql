ALTER TABLE tpa.account_invitation_holds ADD COLUMN version integer NOT NULL DEFAULT 1;
CREATE TABLE tpa.invitation_templates (
 id uuid PRIMARY KEY, subject text NOT NULL, body text NOT NULL,
 created_by text REFERENCES public."user"(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 approved_by text REFERENCES public."user"(id) ON DELETE SET NULL, approved_at timestamptz
);
CREATE TABLE tpa.invitation_template_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), revision integer NOT NULL DEFAULT 0,
 latest_id uuid REFERENCES tpa.invitation_templates(id), approved_id uuid REFERENCES tpa.invitation_templates(id)
);
INSERT INTO tpa.invitation_template_state(singleton) VALUES(true);
CREATE TABLE tpa.invitation_release_reviews (
 id uuid PRIMARY KEY, actor_id text NOT NULL REFERENCES public."user"(id),
 template_id uuid NOT NULL REFERENCES tpa.invitation_templates(id), template_revision integer NOT NULL,
 recipients jsonb NOT NULL, exclusions jsonb NOT NULL, idempotency_key uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour',
 confirmed_at timestamptz, results jsonb
);
CREATE INDEX invitation_release_actor ON tpa.invitation_release_reviews(actor_id,created_at DESC);
