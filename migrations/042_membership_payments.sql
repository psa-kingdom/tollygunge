CREATE TABLE tpa.membership_payments (
 id UUID PRIMARY KEY,
 membership_id UUID NOT NULL REFERENCES tpa.memberships(id) ON DELETE RESTRICT,
 amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
 paid_on DATE NOT NULL,
 method TEXT NOT NULL CHECK(method IN ('UPI','Bank transfer','Cash','Cheque')),
 reference TEXT NOT NULL CHECK(length(reference) BETWEEN 1 AND 100),
 membership_number TEXT NOT NULL,
 membership_type TEXT NOT NULL,
 recipient TEXT NOT NULL,
 confirmed_by TEXT REFERENCES public."user"(id) ON DELETE SET NULL,
 confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 mail_id UUID NOT NULL REFERENCES tpa.onboarding_mail(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX membership_payment_reference_unique ON tpa.membership_payments(method,lower(btrim(reference)));
CREATE INDEX membership_payment_history ON tpa.membership_payments(membership_id,confirmed_at DESC);
