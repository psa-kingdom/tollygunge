export function validateProfile(value: unknown) {
  if (!value || typeof value !== "object")
    throw new Error("Provide your profile details.");
  const input = value as Record<string, unknown>;
  if (
    typeof input.phone !== "string" ||
    typeof input.organization !== "string" ||
    typeof input.newsletter !== "boolean" ||
    !["email", "none"].includes(String(input.contactPreference))
  )
    throw new Error("Check your profile details.");
  const phone = input.phone.trim(),
    organization = input.organization.trim();
  if (
    phone.length > 32 ||
    (phone && !/^[+\d ().-]{5,32}$/.test(phone)) ||
    organization.length > 200
  )
    throw new Error("Check your phone number and organization.");
  return {
    phone,
    organization,
    newsletter: input.newsletter,
    preferences: { contact: input.contactPreference },
  };
}
