ALTER TABLE tpa.staff_roles DROP CONSTRAINT staff_roles_role_check;
ALTER TABLE tpa.staff_roles ADD CHECK(role IN ('super_administrator','administrator','membership_reviewer','content_editor','event_operator','communications_operator','finance_operator'));
CREATE UNIQUE INDEX single_super_administrator ON tpa.staff_roles(role) WHERE role='super_administrator';
CREATE TABLE tpa.finance_entries (
 id UUID PRIMARY KEY, event_id UUID NOT NULL REFERENCES tpa.events(id),
 kind TEXT NOT NULL CHECK(kind IN ('receipt','refund','expenses')),
 source TEXT NOT NULL CHECK(source IN ('member','admin','legacy')),
 registration_id UUID REFERENCES tpa.event_registrations(id),
 label TEXT NOT NULL, amount_paise BIGINT NOT NULL CHECK(amount_paise>=0),
 entry_date DATE NOT NULL, method TEXT NOT NULL DEFAULT '', reference TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
 lines JSONB NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(lines)='array'),
 status TEXT NOT NULL CHECK(status IN ('draft','submitted','returned','approved','superseded')),
 replaces_id UUID REFERENCES tpa.finance_entries(id),
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT REFERENCES public."user"(id),
 reviewed_by TEXT REFERENCES public."user"(id), review_note TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), reviewed_at TIMESTAMPTZ,
 CHECK(source='legacy' OR created_by IS NOT NULL),
 CHECK(reviewed_by IS NULL OR reviewed_by<>created_by)
);
CREATE UNIQUE INDEX finance_one_pending_registration ON tpa.finance_entries(registration_id) WHERE registration_id IS NOT NULL AND status IN ('draft','submitted') AND kind='receipt';
CREATE UNIQUE INDEX finance_one_pending_replacement ON tpa.finance_entries(replaces_id) WHERE replaces_id IS NOT NULL AND status IN ('draft','submitted','returned');
CREATE UNIQUE INDEX finance_one_pending_expense_sheet ON tpa.finance_entries(event_id) WHERE kind='expenses' AND status IN ('draft','submitted','returned');
CREATE INDEX ON tpa.finance_entries(event_id,status);
CREATE TABLE tpa.finance_proofs (
 id UUID PRIMARY KEY, entry_id UUID NOT NULL UNIQUE REFERENCES tpa.finance_entries(id),
 owner_id TEXT NOT NULL REFERENCES public."user"(id),
 content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','application/pdf')),
 byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880)
);
CREATE TABLE tpa.finance_history (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 entry_id UUID NOT NULL REFERENCES tpa.finance_entries(id), actor_id TEXT NOT NULL REFERENCES public."user"(id),
 action TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Preserve every historical collected/refunded amount, including inferred pre-history receipts.
INSERT INTO tpa.finance_entries(id,event_id,kind,source,registration_id,label,amount_paise,entry_date,reference,note,status,created_by)
 SELECT gen_random_uuid(),r.event_id,'receipt','legacy',r.id,'Participant fee',h.fee_paise,(h.created_at AT TIME ZONE 'Asia/Kolkata')::date,h.reference,
 CASE WHEN h.to_status='refunded' THEN 'Inferred original receipt from legacy refund baseline' ELSE h.note END,'approved',h.actor_id
 FROM tpa.event_payment_history h JOIN tpa.event_registrations r ON r.id=h.registration_id
 WHERE (h.to_status='paid' AND (h.from_status IS NULL OR h.from_status IN ('pending','failed'))) OR (h.from_status IS NULL AND h.to_status='refunded');
INSERT INTO tpa.finance_entries(id,event_id,kind,source,registration_id,label,amount_paise,entry_date,reference,note,status,created_by)
 SELECT gen_random_uuid(),r.event_id,'refund','legacy',r.id,'Participant refund',h.fee_paise,(h.created_at AT TIME ZONE 'Asia/Kolkata')::date,h.reference,h.note,'approved',h.actor_id
 FROM tpa.event_payment_history h JOIN tpa.event_registrations r ON r.id=h.registration_id
 WHERE h.to_status='refunded' AND (h.from_status='paid' OR h.from_status IS NULL);
INSERT INTO tpa.finance_entries(id,event_id,kind,source,label,amount_paise,entry_date,lines,status,created_by)
 SELECT gen_random_uuid(),event_id,'expenses','legacy','Legacy approved expense sheet',sum(amount_paise),max(expense_date),
 jsonb_agg(jsonb_build_object('header',category,'description',description,'date',expense_date,'amountPaise',amount_paise,'vendor',vendor,'note',notes,'legacyExpenseId',id,'receiptId',receipt_id) ORDER BY expense_date,id),'approved',
 (array_agg(updated_by ORDER BY expense_date DESC,id))[1]
 FROM tpa.event_expenses WHERE voided_at IS NULL GROUP BY event_id;
