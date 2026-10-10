export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export type DocumentKind = "certificate" | "photograph" | "student_evidence" | "supporting";
export const documentKinds: readonly DocumentKind[] = [
  "certificate",
  "photograph",
  "student_evidence",
  "supporting",
];
export function validateDocument(
  kind: string,
  contentType: string,
  size: number,
) {
  if (!documentKinds.includes(kind as DocumentKind))
    throw new Error("Choose a supported document category.");
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_DOCUMENT_BYTES)
    throw new Error("Files must be between 1 byte and 5 MB.");
  const allowed =
    kind === "photograph"
      ? ["image/jpeg", "image/png"]
      : ["application/pdf", "image/jpeg", "image/png"];
  if (!allowed.includes(contentType))
    throw new Error("Use a PDF, JPEG or PNG; photographs must be JPEG or PNG.");
}
export function matchesFileSignature(
  bytes: Uint8Array,
  contentType: string,
): boolean {
  if (contentType === "application/pdf")
    return (
      bytes.length >= 5 && [37, 80, 68, 70, 45].every((v, i) => bytes[i] === v)
    );
  if (contentType === "image/png")
    return (
      bytes.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
    );
  if (contentType === "image/jpeg")
    return (
      bytes.length >= 3 &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255
    );
  return false;
}
export function privateObjectKey(documentId: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      documentId,
    )
  )
    throw new Error("Invalid document identifier.");
  return `tpa/private/documents/${documentId}`;
}
