CREATE SCHEMA IF NOT EXISTS tpa;

CREATE TABLE tpa.staff_roles (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('administrator','membership_reviewer','content_editor',
    'event_operator','communications_operator','finance_operator')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE tpa.private_documents (
  id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('certificate','photograph','student_evidence')),
  content_type TEXT NOT NULL CHECK (content_type IN ('application/pdf','image/jpeg','image/png')),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 5242880),
  CHECK (kind <> 'photograph' OR content_type IN ('image/jpeg','image/png')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON tpa.private_documents (owner_user_id);

CREATE TABLE tpa.audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Authentication user foreign keys are added with the chosen provider schema.
