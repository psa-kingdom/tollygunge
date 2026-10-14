CREATE TABLE IF NOT EXISTS tpa.account_invitation_holds (
  user_id text PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
  source_batch_id uuid REFERENCES tpa.onboarding_batches(id),
  address_completion_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);
