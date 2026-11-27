ALTER TABLE public."user"
  ADD COLUMN "requestedMembershipPlan" TEXT
  CHECK ("requestedMembershipPlan" IN ('Life', 'Patron'));

CREATE TABLE tpa.registration_codes (
  email TEXT PRIMARY KEY,
  digest TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5)
);
