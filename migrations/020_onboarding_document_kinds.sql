ALTER TABLE tpa.private_documents DROP CONSTRAINT private_documents_kind_check;
ALTER TABLE tpa.private_documents ADD CONSTRAINT private_documents_kind_check
 CHECK(kind IN ('certificate','photograph','student_evidence','supporting'));
