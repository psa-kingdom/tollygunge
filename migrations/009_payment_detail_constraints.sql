ALTER TABLE tpa.payment_qr_images ADD CHECK(width BETWEEN 1 AND 2400 AND height BETWEEN 1 AND 2400);
ALTER TABLE tpa.payment_details ADD CHECK(version>0);
ALTER TABLE tpa.payment_details ADD CHECK(status<>'active' OR active_snapshot IS NOT NULL);
ALTER TABLE tpa.payment_details ADD COLUMN draft_qr_id UUID GENERATED ALWAYS AS ((draft->>'qrId')::uuid) STORED REFERENCES tpa.payment_qr_images(id);
ALTER TABLE tpa.payment_details ADD COLUMN active_qr_id UUID GENERATED ALWAYS AS ((active_snapshot->>'qrId')::uuid) STORED REFERENCES tpa.payment_qr_images(id);
ALTER TABLE tpa.payment_detail_revisions ADD CHECK(version>0 AND status IN('draft','active','past'));
ALTER TABLE tpa.payment_detail_revisions ADD COLUMN qr_id UUID GENERATED ALWAYS AS ((details->>'qrId')::uuid) STORED REFERENCES tpa.payment_qr_images(id);
