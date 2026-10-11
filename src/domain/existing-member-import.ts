/** Compatibility adapter for the existing import workspace. Shared rules own validation. */
import { mapMembers, memberHeaders, type MemberRow } from "./member-import";
export { memberHeaders };
export type MemberImportRow = MemberRow & {
  error?: string; errors: string[]; details: Record<string,string>; category: string; plan?:string;
};
export function existingMemberRows(cells: string[][]): MemberImportRow[] {
  return mapMembers(cells).map((row)=>({ ...row, errors:Object.values(row.fieldErrors),
    ...(Object.keys(row.fieldErrors).length ? {error:Object.values(row.fieldErrors).join(" ")} : {}),
    category:"Professional", details:(row.member ? {fullName:row.name,phone:row.member.mobile,organization:row.member.organization,jobTitle:row.member.designation} : {}) as Record<string,string> }));
}
