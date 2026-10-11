import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { mapMembers, type MemberRow } from "@/domain/member-import";
import { MemberValidationError, memberDisplayName, type MemberInput } from "@/domain/member-foundation";
import { memberFromBody,matchMember,matchCandidates,saveMember } from "./member-register";
import { validateAddresses } from "./member-address";
import { OperationError,audit } from "./operation-api";
import { getDatabase } from "./database";
export function importUpdate(previous: MemberInput, incoming: MemberInput): MemberInput {
  const next = { ...previous };
  for (const [key,value] of Object.entries(incoming)) {
    if (key === "addresses") {
      const addresses = { ...previous.addresses };
      for (const [kind,a] of Object.entries(incoming.addresses)) {
        const old = previous.addresses[kind as keyof typeof addresses];
        const merged = { ...old,...a };
        for (const k of Object.keys(a) as (keyof typeof a)[]) if (!a[k] && old?.[k]) merged[k] = old[k];
        // Do not retain incompatible children when a parent was explicitly changed.
        for (const [parent,children] of [["country",["state","district","city","postalLocality","postalCode"]],["state",["district","city","postalLocality","postalCode"]],["district",["city","postalLocality","postalCode"]]] as const)
          if (old && a[parent] && a[parent].toLowerCase() !== old[parent].toLowerCase()) for(const child of children) if(!a[child]) merged[child]="";
        addresses[kind as keyof typeof addresses] = merged;
      }
      next.addresses=addresses;
    } else if(value) (next as unknown as Record<string,unknown>)[key]=value;
  }
  return next;
}
export async function previewMembers(c: PoolClient, rows: MemberRow[]) {
  const eligible=rows.filter(r=>r.member && !Object.keys(r.fieldErrors).length);
  const candidates=await matchCandidates(c,eligible.map(r=>r.member!));
  const existingMobiles=(await c.query("SELECT id,mobile_normalized FROM tpa.people WHERE mobile_normalized=ANY($1::text[])",[eligible.map(r=>r.member!.mobile).filter(Boolean)])).rows as {id:string;mobile_normalized:string}[];
  for (const row of rows) {
    if (Object.keys(row.fieldErrors).length || !row.member) {row.status ??= "failed"; row.reason=Object.values(row.fieldErrors).join(" "); continue;}
    try {
      const match=await matchMember(c,row.member,candidates);
      const prior=match ? memberFromBody(match.body,String(match.membership.membership_number)) : null;
      const prepared=prior ? importUpdate(prior,row.member) : row.member;
      const beforeAddresses=JSON.parse(JSON.stringify(prepared.addresses));
      prepared.addresses=await validateAddresses(c,prepared.addresses,prior?.addresses);
      for(const [kind,address] of Object.entries(prepared.addresses))
        for(const [field,after] of Object.entries(address)) {
          const before=beforeAddresses[kind]?.[field] ?? "";
          if(before!==after) row.normalizations.push({field:`addresses.${kind}.${field}`,before,after});
        }
      row.member=prepared;
      if(match) {
        row.match={personId:match.personId,personVersion:match.personVersion,membershipVersion:match.membershipVersion};
        row.proposedChanges={};
        for(const key of Object.keys(prepared) as (keyof MemberInput)[]) if(!isDeepStrictEqual(prior![key],prepared[key])) row.proposedChanges[key]={before:prior![key],after:prepared[key]};
        const displayName=memberDisplayName(prepared,match.body);
        if(displayName!==match.body.name) row.proposedChanges.displayName={before:match.body.name,after:displayName};
        row.status="skipped";row.reason="Existing member; select this row explicitly to apply reviewed changes.";
      } else {row.status="created";row.reason="Ready to create a person and membership; account access is optional.";}
      if(prepared.mobile && existingMobiles.some(r=>r.mobile_normalized===prepared.mobile && r.id!==match?.personId)) row.warnings.push("Mobile is already used by another person; review identity.");
    } catch(e) {
      if(e instanceof MemberValidationError) {row.fieldErrors=e.fieldErrors;row.status="failed";row.reason=Object.values(e.fieldErrors).join(" ");}
      else if(e instanceof OperationError && e.status===409) {row.status="conflict";row.reason=e.message;}
      else throw e;
    }
  }
  return rows;
}
export async function createMemberPreview(c: PoolClient, actorId: string, cells: string[][], sourceRows?: number[],cellErrors?: Record<number,string>,preserveExisting=false) {
  const rows=await previewMembers(c,mapMembers(cells,sourceRows,cellErrors)),id=randomUUID();
  if(preserveExisting) for(const row of rows) {
    if(row.match && Object.keys(row.proposedChanges??{}).length) {row.status="conflict";row.reason="Existing member differs from the source. This preservation import cannot overwrite it.";}
    for(const change of row.normalizations.filter(n=>n.field.endsWith(".district") && !n.before && n.after)) {
      const kind=change.field.split(".")[1] as keyof MemberInput["addresses"];
      if(row.member?.addresses[kind]) row.member.addresses[kind]!.district="";
      row.status="conflict";row.fieldErrors[change.field]="District is missing. Preservation imports keep it blank and hold the row rather than deriving it.";row.reason=Object.values(row.fieldErrors).join(" ");
      row.warnings.push(`Postal reference suggests ${change.after}; no district was retained or approved.`);
    }
    row.normalizations=row.normalizations.filter(n=>!(n.field.endsWith(".district") && !n.before && n.after));
  }
  await c.query("INSERT INTO tpa.onboarding_batches(id,actor_id,rows,mode,choices) VALUES($1,$2,$3,'members',$4)",[id,actorId,JSON.stringify(rows),JSON.stringify({preserveExisting,allowDistrictDerivation:!preserveExisting})]);
  await audit(c,actorId,"members.import_previewed",id);
  return {id,version:1,mode:"members",rows};
}
export async function commitMembers(c: PoolClient, actorId: string, batch: {id:string;rows:MemberRow[];choices?:{updateRows?:number[];provisionAccounts?:boolean;preserveExisting?:boolean}}) {
  if(batch.choices?.preserveExisting && (batch.choices.provisionAccounts || batch.choices.updateRows?.length)) throw new OperationError("Preservation imports cannot update records or provision accounts.",400,"preservation_import");
  const selected=new Set(batch.choices?.updateRows ?? []),results=[];
  for(const row of batch.rows) {
    const identity={sourceRow:row.sourceRow,email:row.email,membershipNumber:row.membershipNumber};
    if(!row.member || row.status==="failed" || row.status==="conflict") {results.push({...identity,status:row.status??"failed",reason:row.reason,fieldErrors:row.fieldErrors});continue;}
    if(row.match && !selected.has(row.sourceRow)) {results.push({...identity,status:"skipped",reason:"Existing member; update was not selected."});continue;}
    await c.query("SAVEPOINT register_row");
    try {
      const match=await matchMember(c,row.member);
      if(row.match) {
        if(!match || !isDeepStrictEqual({personId:match.personId,personVersion:match.personVersion,membershipVersion:match.membershipVersion},row.match)) throw new OperationError("Member changed since preview. Preview again.",409,"stale_member");
      } else if(match) {results.push({...identity,status:"skipped",reason:"Member was created after preview; no overwrite."});continue;}
      if(row.match && !Object.keys(row.proposedChanges??{}).length && !batch.choices?.provisionAccounts) {results.push({...identity,status:"skipped",reason:"No changes."});continue;}
      const saved=await saveMember(c,actorId,{member:row.member,...row.match,provisionAccount:batch.choices?.provisionAccounts===true},"import");
      results.push({...identity,...saved,warnings:row.warnings});
    } catch(e) {
      await c.query("ROLLBACK TO SAVEPOINT register_row");
      const code=(e as {code?:string}).code;
      results.push({...identity,status:e instanceof OperationError && e.status===409 || code==="23505" ? "conflict" : "failed",
        reason:e instanceof OperationError ? e.message : e instanceof MemberValidationError ? Object.values(e.fieldErrors).join(" ") : code==="23505" ? "Concurrent email or membership-number conflict." : "Creation failed; no partial records retained.",
        ...(e instanceof MemberValidationError ? {fieldErrors:e.fieldErrors} : {})});
    } finally {await c.query("RELEASE SAVEPOINT register_row");}
  }
  return results;
}
export async function memberBatchAction(c: PoolClient, actorId: string, input: Record<string,unknown>) {
  const b=(await c.query("SELECT * FROM tpa.onboarding_batches WHERE id::text=$1 AND actor_id=$2 AND mode='members' FOR UPDATE",[input.id,actorId])).rows[0];
  if(!b) throw new OperationError("Preview not found.",404);
  if(b.committed_at) return {results:b.results,duplicate:true};
  if(typeof b.choices?.allowDistrictDerivation!=="boolean" || b.choices.preserveExisting && b.choices.allowDistrictDerivation!==false)
    throw new OperationError("Preview policy changed. Preview again before committing.",409,"stale_batch_policy");
  if(input.action!=="commit" && input.action!=="choices") throw new OperationError("Choose commit or choices.");
  if(input.version!==b.version && !(input.action==="commit" && input.version===undefined && b.version===1)) throw new OperationError("Preview choices changed. Reload.",409,"stale_batch");
  if(input.action==="choices") {
    if(b.choices?.preserveExisting && (input.provisionAccounts || Array.isArray(input.updateRows) && input.updateRows.length)) throw new OperationError("Preservation imports cannot update records or provision accounts.",400,"preservation_import");
    if(!Array.isArray(input.updateRows) || input.updateRows.some((n)=>!Number.isInteger(n) || !b.rows.some((r:MemberRow)=>r.sourceRow===n && r.match && r.status==="skipped")) || typeof input.provisionAccounts!=="boolean") throw new OperationError("Choose eligible update rows and an account option.");
    await c.query("UPDATE tpa.onboarding_batches SET choices=$2,version=version+1 WHERE id=$1",[b.id,JSON.stringify({...b.choices,updateRows:input.updateRows,provisionAccounts:input.provisionAccounts})]);
    return {id:b.id,version:b.version+1,choices:{updateRows:input.updateRows,provisionAccounts:input.provisionAccounts}};
  }
  const results=await commitMembers(c,actorId,b);
  await c.query("UPDATE tpa.onboarding_batches SET committed_at=now(),results=$2 WHERE id=$1",[b.id,JSON.stringify(results)]);
  await audit(c,actorId,"members.import_committed",b.id);
  const totals=Object.fromEntries(["created","updated","skipped","conflict","failed"].map((status)=>[status,results.filter((r)=>r.status===status).length]));
  return {id:b.id,results,totals};
}
export async function isMemberBatch(id: unknown, actorId: string) {
  return !!(await getDatabase().query("SELECT 1 FROM tpa.onboarding_batches WHERE id::text=$1 AND actor_id=$2 AND mode='members'",[typeof id === "string"?id:"",actorId])).rowCount;
}
