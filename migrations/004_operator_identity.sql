-- Explicit operator approval is separate from proof of mailbox ownership.
-- Only an offline provisioning operation may insert this record.
CREATE TABLE tpa.operator_approved_identities (
  user_id TEXT PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL CHECK (source = 'user_authorized_bootstrap')
);
