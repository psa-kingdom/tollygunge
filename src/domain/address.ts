export const addressKeys = ["officeAddress", "residenceAddress"] as const;
export type AddressKey = typeof addressKeys[number];
export type StructuredAddress = {
  country: string; state: string; district: string; city: string;
  postalCode: string; line1: string; line2: string;
  postalLocality: string;
};
export const emptyAddress: StructuredAddress = {
  country: "IN", state: "", district: "", city: "", postalCode: "", line1: "", line2: "", postalLocality:"",
};
export function parseAddress(value: string): StructuredAddress {
  const input: unknown = JSON.parse(value);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("Check your address.");
  const record = input as Record<string, unknown>;
  const address = { ...emptyAddress };
  for (const key of Object.keys(address) as (keyof StructuredAddress)[]) {
    if (key==="postalLocality" && record[key]===undefined) continue;
    if (typeof record[key] !== "string" || record[key].length > (key === "line1" || key === "line2" ? 1000 : 200))
      throw Error("Check your address fields.");
    address[key] = record[key].trim();
  }
  if (!/^[A-Z]{2}$/.test(address.country)) throw Error("Choose an address country.");
  if (address.country === "IN" && address.postalCode && !/^[1-9]\d{0,5}$/.test(address.postalCode))
    throw Error("Enter a six-digit Indian PIN.");
  if (address.country === "IN" && ((address.district && !address.state) || (address.city && !address.district)))
    throw Error("Choose State and District before your postal locality.");
  return address;
}
export function formatAddress(address: StructuredAddress) {
  return [address.line1, address.line2, address.city, address.postalLocality, address.district, address.state,
    address.postalCode, address.country].filter(Boolean).join(", ");
}
export function normalizeAddresses(details: Record<string, string>) {
  const result = { ...details };
  for (const key of addressKeys) {
    const structured = details[`${key}Structured`];
    if (structured) {
      const value = parseAddress(structured);
      result[`${key}Structured`] = JSON.stringify(value);
      result[key] = formatAddress(value);
    }
  }
  return result;
}
export function addressComplete(address: StructuredAddress) {
  return !!(address.line1 && address.country && address.state && address.postalCode &&
    (address.country === "IN" ? address.district && address.postalLocality : address.city));
}
