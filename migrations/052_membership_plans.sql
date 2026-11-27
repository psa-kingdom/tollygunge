CREATE TABLE tpa.membership_plans (
 code text PRIMARY KEY CHECK(code IN ('Free','Life','Patron')),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 80),
 cost_paise integer NOT NULL CHECK(cost_paise BETWEEN 0 AND 999999999),
 benefits text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(code <> 'Free' OR cost_paise=0)
);
INSERT INTO tpa.membership_plans(code,name,cost_paise,benefits) VALUES
 ('Free','Free',0,'Community membership and registration for public events. Event fees may apply.'),
 ('Life','Life',0,''),
 ('Patron','Patron',0,'');
ALTER TABLE tpa.membership_plans ADD COLUMN cost_configured boolean NOT NULL DEFAULT false;
UPDATE tpa.membership_plans SET cost_configured=true WHERE code='Free';
