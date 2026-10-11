/** Compatibility exports; the person-linked register is the sole member writer. */
import type { PoolClient } from "pg";
import { matchMember } from "./member-register";
import { commitMembers } from "./member-import";
import type { MemberImportRow } from "../domain/existing-member-import";
import { OperationError } from "./operation-api";
export async function memberConflict(c: PoolClient,row:MemberImportRow) {
  if(!row.member) return {status:"conflict",reason:row.error ?? "Invalid member."};
  try { const match=await matchMember(c,row.member); return match ? {status:"skipped",reason:"Existing member; no overwrite.",personId:match.personId} : null; }
  catch(e) {if(e instanceof OperationError) return {status:"conflict",reason:e.message};throw e;}
}
export async function commitExistingMembers(c:PoolClient,batch:{id:string;rows:MemberImportRow[]},actorId:string) {
  return commitMembers(c,actorId,batch);
}
