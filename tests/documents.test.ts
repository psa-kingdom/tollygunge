import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDocument,
  matchesFileSignature,
  privateObjectKey,
  MAX_DOCUMENT_BYTES,
} from "../src/domain/documents";
test("rejects unsafe upload categories, formats and sizes", () => {
  assert.throws(() => validateDocument("photograph", "application/pdf", 100));
  assert.throws(() => validateDocument("certificate", "image/svg+xml", 100));
  assert.throws(() =>
    validateDocument("certificate", "application/pdf", MAX_DOCUMENT_BYTES + 1),
  );
  assert.throws(() => validateDocument("certificate", "application/pdf", 0));
  assert.throws(() => validateDocument("other", "application/pdf", 100));
  assert.doesNotThrow(() =>
    validateDocument("student_evidence", "application/pdf", 100),
  );
});
test("file signatures must match the claimed MIME type", () => {
  assert.equal(
    matchesFileSignature(Buffer.from("%PDF-1.7"), "application/pdf"),
    true,
  );
  assert.equal(
    matchesFileSignature(Buffer.from("<script>"), "application/pdf"),
    false,
  );
  assert.equal(
    matchesFileSignature(Uint8Array.from([255, 216, 255]), "image/jpeg"),
    true,
  );
  assert.equal(
    matchesFileSignature(
      Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
      "image/png",
    ),
    true,
  );
  assert.equal(
    matchesFileSignature(Uint8Array.from([255, 216, 255]), "image/png"),
    false,
  );
});
test("object keys cannot escape the TPA private namespace", () => {
  assert.throws(() => privateObjectKey("../../other-project/file"));
  assert.equal(
    privateObjectKey("12345678-1234-1234-1234-123456789abc"),
    "tpa/private/documents/12345678-1234-1234-1234-123456789abc",
  );
});
