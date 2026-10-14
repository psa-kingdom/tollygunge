/** Only allowlisted categories are logged. Never log messages, SQL or payloads. */
export function workerFailureCategory(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (["42P01", "42703", "42883"].includes(code)) return "database_schema";
  if (["28P01", "28000"].includes(code)) return "database_authentication";
  if (["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "57P01", "08006", "08001"].includes(code)) return "database_connection";
  if (["53300", "53400"].includes(code)) return "database_capacity";
  if (["CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(code)) return "database_tls";
  if (["network", "quota", "suppressed", "provider_unavailable"].includes(code)) return "email_provider";
  if (typeof error === "object" && error !== null && "name" in error && error.name === "EmailProviderError") return "email_provider";
  return "unexpected_failure";
}
