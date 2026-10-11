export const passwordPolicy = { minimum: 8, maximum: 128 } as const;
export function passwordError(value: string) {
  return value.length < passwordPolicy.minimum
    ? `Use at least ${passwordPolicy.minimum} characters.`
    : value.length > passwordPolicy.maximum
      ? `Use no more than ${passwordPolicy.maximum} characters.`
      : "";
}
