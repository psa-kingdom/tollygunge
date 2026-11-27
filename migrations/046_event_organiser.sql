ALTER TABLE tpa.events ADD COLUMN organiser TEXT
  CHECK (organiser IN ('CA CP Study Circle', 'TPA'));
