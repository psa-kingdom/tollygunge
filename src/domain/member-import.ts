import { memberInput, membershipKey, MemberValidationError, type MemberInput } from "./member-foundation";
export const memberHeaders = ["Prefix", "First Name", "Last Name", "Membership No.", "Email", "Mobile", "Designation", "Organisation", "Address", "Country", "State", "City", "Pin"];
export type MemberRow = {
  sourceRow: number; source: Record<string, string>; member?: MemberInput;
  email: string; membershipNumber: string; name: string;
  fieldErrors: Record<string, string>; warnings: string[];
  normalizations: { field: string; before: string; after: string }[];
  match?: { personId: string; personVersion: number; membershipVersion: number };
  proposedChanges?: Record<string, { before: unknown; after: unknown }>;
  status?: "created" | "updated" | "skipped" | "conflict" | "failed";
  reason?: string;
};
export function mapMembers(cells: string[][], sourceRows = cells.map((_, i) => i + 1), cellErrors: Record<number, string> = {}): MemberRow[] {
  const headers = cells[0]?.map((x) => x.trim()) ?? [];
  if (cells.length < 2 || cells.length > 1001 || headers.length !== memberHeaders.length || new Set(headers).size !== headers.length || memberHeaders.some((h) => !headers.includes(h)))
    throw new MemberValidationError({ file: "Use the 13-column member template with 1–1,000 populated rows." });
  const rows = cells.slice(1).map((values, index): MemberRow => {
    const source = Object.fromEntries(headers.map((h, i) => [h, String(values[i] ?? "")]));
    const row: MemberRow = { sourceRow: sourceRows[index+1], source, email: source.Email.trim().toLowerCase(),membershipNumber: source["Membership No."].trim(), name: "", fieldErrors: {}, warnings: [], normalizations: [] };
    const addressPresent = ["Address","Country","State","City","Pin"].some((h) => source[h].trim());
    try {
      row.member = memberInput({prefix:source.Prefix,firstName:source["First Name"],lastName:source["Last Name"],email:source.Email,mobile:source.Mobile,
        membershipNumber:source["Membership No."],designation:source.Designation,organization:source.Organisation,
        addresses: addressPresent ? { correspondence: {line1:source.Address,country:source.Country,state:source.State,city:source.City,postalCode:source.Pin} } : {} });
      row.name = [row.member.firstName,row.member.lastName].join(" ");
      const mapped: Record<string,string> = {Prefix:row.member.prefix,"First Name":row.member.firstName,"Last Name":row.member.lastName,Email:row.member.email,Mobile:row.member.mobile,"Membership No.":row.member.membershipNumber,Designation:row.member.designation,Organisation:row.member.organization};
      for (const [field,after] of Object.entries(mapped)) if (source[field] !== after) row.normalizations.push({field,before:source[field],after});
    } catch (e) { if (!(e instanceof MemberValidationError)) throw e; row.fieldErrors = e.fieldErrors; }
    if (cellErrors[row.sourceRow]) row.fieldErrors.file = cellErrors[row.sourceRow];
    for (const [key, v] of Object.entries(source))
      if (/^[=+@]/.test(v.trim()) && !(key === "Mobile" && /^\+\d[\d ().-]*$/.test(v.trim())) || /^-\D/.test(v.trim())) row.fieldErrors[key] = "Formula-like cell content is not accepted.";
    if (values.length > headers.length && values.slice(headers.length).some(Boolean)) row.fieldErrors.file = "Unexpected data beyond the template columns.";
    return row;
  });
  for (const [key, norm] of [["email",(s: string) => s.toLowerCase()], ["membershipNumber",membershipKey]] as const) {
    const groups = new Map<string,MemberRow[]>();
    for (const r of rows) { const k=norm(r[key]); if(k) groups.set(k,[...(groups.get(k)??[]),r]); }
    for (const group of groups.values()) if (group.length>1) for(const r of group) {
      r.status="conflict"; r.fieldErrors[key]=`Duplicate ${key} in source rows ${group.map((x)=>x.sourceRow).join(", ")}. All matching rows are held.`;
    }
  }
  const mobiles = new Map<string,MemberRow[]>();
  for (const r of rows) if(r.member?.mobile) mobiles.set(r.member.mobile,[...(mobiles.get(r.member.mobile)??[]),r]);
  for(const group of mobiles.values()) if(group.length>1) for(const r of group) r.warnings.push("Shared mobile in file; review identity. Mobile is not a unique identity.");
  return rows;
}
