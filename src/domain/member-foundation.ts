/** Shared, environment-independent member input contract. */
export class MemberValidationError extends Error {
  readonly code = "member_validation";
  constructor(public fieldErrors: Record<string, string>) {
    super("Check the submitted member details.");
  }
}
export function clean(value: unknown, field: string, max = 200): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
    throw new MemberValidationError({ [field]: "Use text within the field limit." });
  return value.trim().replace(/\s+/g, " ");
}
export function email(value: unknown, required = false) {
  const result = clean(value, "email", 254).toLowerCase();
  if ((required || result) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new MemberValidationError({ email: "Provide a valid email." });
  return result;
}
export function mobile(value: unknown) {
  const raw = clean(value, "mobile", 32);
  if (!raw) return "";
  if (!/^[+\d ().-]+$/.test(raw))
    throw new MemberValidationError({ mobile: "Provide a valid mobile number." });
  let digits = raw.replace(/[ ().-]/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) digits = "+91" + digits;
  else if (/^91[6-9]\d{9}$/.test(digits)) digits = "+" + digits;
  if (!/^\+[1-9]\d{7,14}$/.test(digits) || (digits.startsWith("+91") && !/^\+91[6-9]\d{9}$/.test(digits)))
    throw new MemberValidationError({ mobile: "Use a 10-digit Indian mobile or an international number with country code." });
  return digits;
}
export const prefixes = ["Mr", "Mrs", "Miss", "Ms", "Dr", "Prof", "CA", "CS", "CMA", "Adv", "Other"] as const;
export function prefix(value: unknown) {
  const raw = clean(value, "prefix", 30).replace(/\./g, "");
  if (!raw) return "";
  const found = prefixes.find((p) => p.toLowerCase() === raw.toLowerCase());
  if (!found) throw new MemberValidationError({ prefix: "Choose a recognized prefix." });
  return found;
}
export function professionalOnly(value: unknown) {
  if (value !== undefined && value !== "Professional")
    throw new MemberValidationError({ category: "Only Professional membership is supported." });
}
export const addressKinds = ["office", "residence", "correspondence"] as const;
const countryCodes=new Set("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" "));
export function country(value:unknown) {
  const raw=clean(value,"country",200),code=/^india$/i.test(raw)?"IN":raw.toUpperCase();
  if(code && !countryCodes.has(code)) throw new MemberValidationError({country:"Use a valid ISO two-letter country code or India."});
  return code;
}
export type Address = {
  line1: string; line2: string; country: string; state: string; district: string;
  city: string; postalLocality: string; postalCode: string;
};
/** Postal format checks, never proof of a deliverable address. */
export function internationalPostalCode(countryCode:string,value:string,partial=false) {
  if(partial) return /^[A-Z0-9][A-Z0-9 -]{0,15}$/i.test(value);
  const formats:Record<string,RegExp>={US:/^\d{5}(?:-\d{4})?$/,CA:/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i,GB:/^(?:[A-Z]{1,2}\d[A-Z\d]?|GIR) ?\d[A-Z]{2}$/i};
  return (formats[countryCode] ?? /^[A-Z0-9][A-Z0-9 -]{1,15}$/i).test(value);
}
export type Addresses = Partial<Record<(typeof addressKinds)[number], Address>>;
export type MemberInput = {
  prefix: string; firstName: string; lastName: string; email: string; mobile: string;
  designation: string; organization: string; membershipNumber: string; addresses: Addresses;
};
export function memberDisplayName(input:Pick<MemberInput,"prefix"|"firstName"|"lastName">,previous?:{name?:string;prefix?:string;firstName?:string;lastName?:string}) {
  const next=[input.prefix,input.firstName,input.lastName].filter(Boolean).join(" ");
  if(!previous?.name) return next;
  const generated=[previous.prefix,previous.firstName,previous.lastName].filter(Boolean).join(" ");
  const plain=[previous.firstName,previous.lastName].filter(Boolean).join(" ");
  return previous.name===generated || previous.name===plain ? next : previous.name;
}
export function memberInput(value: unknown, required = true): MemberInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new MemberValidationError({ member: "Provide member details." });
  const i = value as Record<string, unknown>, errors: Record<string, string> = {};
  professionalOnly(i.category);
  const get = (field: string, fn: () => string) => {
    try { return fn(); } catch (e) {
      if (!(e instanceof MemberValidationError)) throw e;
      Object.assign(errors, e.fieldErrors); return "";
    }
  };
  const out: MemberInput = {
    prefix: get("prefix", () => prefix(i.prefix)),
    firstName: get("firstName", () => clean(i.firstName, "firstName", 120)),
    lastName: get("lastName", () => clean(i.lastName, "lastName", 120)),
    email: get("email", () => email(i.email, required)),
    mobile: get("mobile", () => mobile(i.mobile)),
    designation: get("designation", () => clean(i.designation, "designation", 120)),
    organization: get("organization", () => clean(i.organization, "organization", 200)),
    membershipNumber: get("membershipNumber", () => clean(i.membershipNumber, "membershipNumber", 80)),
    addresses: {},
  };
  if (out.membershipNumber && !/^[\p{L}\p{N}][\p{L}\p{N} /_.-]*$/u.test(out.membershipNumber))
    errors.membershipNumber = "Use a membership number containing letters, digits or ordinary separators.";
  if (required) for (const k of ["firstName", "lastName", "email", "membershipNumber"] as const)
    if (!out[k] && !errors[k]) errors[k] = "This field is required.";
  if(memberDisplayName(out).length>120) errors.firstName="The combined display name must be at most 120 characters.";
  if (i.addresses !== undefined) {
    if (!i.addresses || typeof i.addresses !== "object" || Array.isArray(i.addresses)) errors.addresses = "Provide structured addresses.";
    else for (const [kind, a] of Object.entries(i.addresses)) {
      if (!addressKinds.includes(kind as typeof addressKinds[number]) || !a || typeof a !== "object" || Array.isArray(a)) {
        errors.addresses = "Use office, residence or correspondence addresses."; continue;
      }
      const address = {} as Address;
      for (const k of ["line1", "line2", "country", "state", "district", "city", "postalLocality", "postalCode"] as const)
        address[k] = get(`addresses.${kind}.${k}`, () => clean((a as Record<string, unknown>)[k], `addresses.${kind}.${k}`, k === "line1" ? 1000 : 200));
      out.addresses[kind as typeof addressKinds[number]] = address;
    }
  }
  if (Object.keys(errors).length) throw new MemberValidationError(errors);
  return out;
}
export const membershipKey = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
