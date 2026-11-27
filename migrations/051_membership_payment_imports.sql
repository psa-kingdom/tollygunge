CREATE TABLE tpa.membership_payment_imports (
 id uuid PRIMARY KEY,
 actor_id text REFERENCES public."user"(id) ON DELETE SET NULL,
 filename text NOT NULL,
 rows jsonb NOT NULL,
 status text NOT NULL DEFAULT 'preview' CHECK(status IN ('preview','imported')),
 created_at timestamptz NOT NULL DEFAULT now(),
 imported_at timestamptz
);
CREATE TABLE tpa.imported_membership_payments (
 id uuid PRIMARY KEY,
 import_id uuid NOT NULL REFERENCES tpa.membership_payment_imports(id),
 name text NOT NULL,
 email text NOT NULL,
 mobile text NOT NULL,
 membership_plan text NOT NULL CHECK(membership_plan IN ('Free','Annual','Life','Patron')),
 amount_paise integer NOT NULL CHECK(amount_paise > 0),
 fingerprint text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
