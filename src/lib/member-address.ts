import type { Pool, PoolClient } from "pg";
import { reviewedPostalCities } from "@/domain/postal-cities";
import { type Address, type Addresses, MemberValidationError, country, internationalPostalCode } from "@/domain/member-foundation";
import { OperationError } from "./operation-error";
type DB = Pick<Pool | PoolClient, "query">;
export async function postalVersion(db: DB) {
  const row = (await db.query("SELECT id,source_url,source_sha256,loaded_at FROM tpa.postal_versions WHERE active")).rows[0];
  if (!row) throw new OperationError("Postal reference data has not been provisioned.", 503, "postal_unavailable");
  return row;
}
export async function validateAddresses(db: DB, input: Addresses, previous: Addresses = {}, partial = false, locationMode: "reference" | "as-entered" = "reference"): Promise<Addresses> {
  const result: Addresses = { ...previous };
  for (const [kind, supplied] of Object.entries(input)) {
    const old = previous[kind as keyof Addresses];
    if (old && JSON.stringify(supplied) === JSON.stringify(old)) continue;
    const a: Address = { ...supplied };
    const path = `addresses.${kind}.`;
    const fail = (field: string, message: string): never => { throw new MemberValidationError({ [path + field]: message }); };
    // Parent changes cannot retain stale, omitted child values.
    if (old) {
      for (const [parent, children] of [
        ["country", ["state", "district", "city", "postalLocality", "postalCode"]],
        ["state", ["district", "city", "postalLocality", "postalCode"]],
        ["district", ["city", "postalLocality", "postalCode"]],
      ] as [keyof Address, (keyof Address)[]][]) {
        if (a[parent] && a[parent].toLowerCase() !== old[parent]?.toLowerCase())
          for (const child of children) if (!a[child]) a[child] = "";
      }
    }
    if (!Object.values(a).some(Boolean)) { result[kind as keyof Addresses] = a; continue; }
    try {a.country=country(a.country);} catch {fail("country","Use a valid ISO two-letter country code or India.");}
    if (!partial && (!a.line1 || !a.country || !a.postalCode)) fail("line1", "An address needs line 1, country and postal code.");
    if (!a.country && Object.values(a).some(Boolean) && !partial) fail("country", "Choose a country.");
    if (a.country === "IN") {
      if (a.postalCode && !(partial ? /^[1-9]\d{0,5}$/ : /^[1-9]\d{5}$/).test(a.postalCode)) fail("postalCode", "Use a six-digit Indian PIN.");
      if (a.postalCode || a.state || a.district || a.city || a.postalLocality) {
        const v = await postalVersion(db);
        const fullPin=a.postalCode.length===6 ? a.postalCode : "";
        const all = (await db.query("SELECT pin,state,district,locality FROM tpa.postal_locations WHERE version_id=$1 AND ($2='' OR pin=$2) AND ($3='' OR lower(state)=lower($3))", [v.id, fullPin, fullPin ? "" : a.state])).rows as { pin: string; state: string; district: string; locality: string }[];
        if (fullPin && !all.length) {
          for (const key of ["state", "district", "city", "postalLocality"] as const) {
            const value = a[key].trim();
            if (value.length > 120 || /[\x00-\x1f\x7f]/.test(value)) fail(key, "Enter a location of up to 120 characters.");
            a[key] = value;
          }
          if (!partial && (!a.state || (locationMode === "reference" && !a.district))) fail("state", locationMode === "reference" ? "Enter your state and district when the PIN cannot be found." : "Enter your state when the PIN cannot be found.");
          result[kind as keyof Addresses] = a;
          continue;
        }
        let matches = all;
        for (const [key, column] of [["state", "state"], ["district", "district"]] as const) {
          if (key === "district" && locationMode === "as-entered") continue;
          if (a[key]) {
            matches = matches.filter((r) => r[column].toLowerCase() === a[key].toLowerCase());
            if (!matches.length) fail(key, "Value does not match the selected postal hierarchy.");
            a[key] = matches[0][column];
          }
        }
        for (const key of ["state", "district"] as const) {
          if (key === "district" && locationMode === "as-entered") continue;
          const values = [...new Set(matches.map((r) => r[key]))];
          if (!a[key] && values.length === 1) a[key] = values[0];
          if (!a[key] && !partial) fail(key, "Choose a value; the postal result is ambiguous.");
        }
        for (const key of ["city", "postalLocality"] as const) {
          const value = a[key].trim();
          if (value.length > 120 || /[\x00-\x1f\x7f]/.test(value)) fail(key, "Enter a location of up to 120 characters.");
          a[key] = value;
        }
      }
    } else {
      if(!partial && locationMode === "reference" && !a.city) fail("city","Provide the city for an international address.");
      if (a.postalCode && !internationalPostalCode(a.country,a.postalCode,partial)) fail("postalCode", "Check the postal code for the selected country.");
    }
    result[kind as keyof Addresses] = a;
  }
  return result;
}

/** Return reviewed city names only within the selected PIN / hierarchy. */
export async function postalCities(
  db: DB,
  version: string,
  { pin = "", state = "", district = "" }: { pin?: string; state?: string; district?: string },
): Promise<string[]> {
  if (!pin && !(state && district)) return [];
  const result = await db.query(
    `SELECT DISTINCT a.city FROM tpa.postal_city_aliases a
     WHERE a.version_id=$1
       AND ($2='' OR lower(a.state)=lower($2))
       AND ($3='' OR lower(a.district)=lower($3))
       AND EXISTS (
         SELECT 1 FROM tpa.postal_locations l
         WHERE l.version_id=a.version_id
           AND lower(l.state)=lower(a.state)
           AND lower(l.district)=lower(a.district)
           AND ($4='' OR l.pin=$4)
       ) ORDER BY a.city`,
    [version, state, district, pin],
  );
  return [...new Set<string>([...result.rows.map((row) => row.city), ...reviewedPostalCities({ pin, state, district })])].sort();
}
