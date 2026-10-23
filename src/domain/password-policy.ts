// New credentials have a separate contract from previously stored credentials.
export const passwordPolicy = { minimum: 6, maximum: 12 } as const;
export const existingPasswordMaximum = 128;
export function passwordError(value: string) {
  return value.length < passwordPolicy.minimum
    ? `Use at least ${passwordPolicy.minimum} characters.`
    : value.length > passwordPolicy.maximum
      ? `Use no more than ${passwordPolicy.maximum} characters.`
      : "";
}
// Only password-setting endpoints use the new limit; verification stays compatible.
export function newCredentialError(path: string, body: Record<string, unknown> | undefined) {
  const key = path === "/sign-up/email" ? "password"
    : ["/reset-password", "/change-password", "/set-password"].includes(path) ? "newPassword" : null;
  const value = key && body?.[key];
  return typeof value === "string" ? passwordError(value) : "";
}
