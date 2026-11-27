export const registrationFields = [
  { name: "prefix", label: "Prefix", autoComplete: "honorific-prefix" },
  { name: "firstName", label: "First name", autoComplete: "given-name", required: true },
  { name: "lastName", label: "Last name", autoComplete: "family-name" },
  { name: "mobile", label: "Mobile number", autoComplete: "tel", type: "tel", required: true },
  { name: "organization", label: "Organisation", autoComplete: "organization" },
  { name: "jobTitle", label: "Designation", autoComplete: "organization-title" },
  { name: "address", label: "Street address", autoComplete: "street-address" },
  { name: "city", label: "City", autoComplete: "address-level2" },
  { name: "state", label: "State", autoComplete: "address-level1" },
  { name: "country", label: "Country", autoComplete: "country-name" },
  { name: "pin", label: "Postal code", autoComplete: "postal-code" },
] as const;
