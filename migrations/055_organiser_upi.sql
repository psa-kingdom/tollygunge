ALTER TABLE tpa.payment_details ADD COLUMN organiser text CHECK(organiser IN ('TPA','CA CP Study Circle'));
