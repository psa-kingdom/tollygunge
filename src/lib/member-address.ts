import type { Pool, PoolClient } from "pg";
import { type Address, type Addresses, MemberValidationError, country, internationalPostalCode } from "@/domain/member-foundation";
import { OperationError } from "./operation-api";
type DB = Pick<Pool | PoolClient, "query">;
export async function postalVersion(db: DB) {
  const row = (await db.query("SELECT id,source_url,source_sha256,loaded_at FROM tpa.postal_versions WHERE active")).rows[0];
  if (!row) throw new OperationError("Postal reference data has not been provisioned.", 503, "postal_unavailable");
  return row;
}
export async function validateAddresses(db: DB, input: Addresses, previous: Addresses = {}, partial = false): Promise<Addresses> {
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
        const all = (await db.query("SELECT pin,state,district,locality FROM tpa.postal_locations WHERE version_id=$1 AND ($2='' OR pin=$2) AND ($3='' OR lower(state)=lower($3))", [v.id, fullPin,a.state])).rows as { pin: string; state: string; district: string; locality: string }[];
        if (fullPin && !all.length) fail("postalCode", "PIN/state combination not found in the postal reference.");
        let matches = all;
        for (const [key, column] of [["state", "state"], ["district", "district"], ["postalLocality", "locality"]] as const) {
          if (a[key]) {
            matches = matches.filter((r) => r[column].toLowerCase() === a[key].toLowerCase());
            if (!matches.length) fail(key, "Value does not match the selected postal hierarchy.");
            a[key] = matches[0][column];
          }
        }
        for (const key of ["state", "district"] as const) {
          const values = [...new Set(matches.map((r) => r[key]))];
          if (!a[key] && values.length === 1) a[key] = values[0];
          if (!a[key] && !partial) fail(key, "Choose a value; the postal result is ambiguous.");
        }
        if (a.city) {
          const cities = (await db.query("SELECT DISTINCT city FROM tpa.postal_city_aliases WHERE version_id=$1 AND lower(state)=lower($2) AND lower(district)=lower($3) AND lower(alias)=lower($4)", [v.id, a.state, a.district, a.city])).rows;
          if (cities.length !== 1) fail("city", "City is unsupported or ambiguous for this state and district. Correct the city or provision a reviewed alias.");
          a.city = cities[0].city;
        }
      }
    } else {
      if(!partial && !a.city) fail("city","Provide the city for an international address.");
      if (a.postalCode && !internationalPostalCode(a.country,a.postalCode,partial)) fail("postalCode", "Check the postal code for the selected country.");
    }
    result[kind as keyof Addresses] = a;
  }
  return result;
}
