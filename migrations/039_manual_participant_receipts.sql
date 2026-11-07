ALTER TABLE tpa.finance_entries ADD COLUMN manual_participant_name TEXT;
ALTER TABLE tpa.finance_entries ADD CONSTRAINT finance_manual_participant_receipt CHECK (
  manual_participant_name IS NULL OR (
    kind = 'receipt' AND source = 'admin' AND registration_id IS NULL
    AND length(trim(manual_participant_name)) BETWEEN 1 AND 160
  )
);
