import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient, Pool } from "pg";
import { memberInput, membershipKey, memberDisplayName, type MemberInput } from "@/domain/member-foundation";
import { personBody, type PersonBody } from "@/domain/people";
import { validateAddresses } from "./member-address";
import { OperationError, audit } from "./operation-api";
import { createInvitedAccount } from "./account-provisioning";
type DB = Pick<Pool | PoolClient, "query">;
export type Match = { personId: string; personVersion: number; membershipVersion: number; body: PersonBody; membership: Record<string, unknown> };
export type MatchRow={id:string;version:number;accepted:PersonBody;contact_email:string|null;membership_id:string|null;membership_version:number;membership_number:string|null;type:string|null;status:string|null;valid_from:unknown;valid_until:unknown};
export async function matchCandidates(db:DB,inputs:MemberInput[]):Promise<MatchRow[]> {
  return (await db.query(`SELECT p.id,p.version,p.accepted,p.contact_email,m.id AS membership_id,m.version AS membership_version,m.membership_number,m.type,m.status,m.valid_from,m.valid_until FROM tpa.people p LEFT JOIN tpa.memberships m ON m.person_id=p.id WHERE lower(btrim(p.contact_email))=ANY($1::text[]) OR lower(regexp_replace(btrim(m.membership_number),'[[:space:]]+',' ','g'))=ANY($2::text[])`,[inputs.map(i=>i.email),inputs.map(i=>membershipKey(i.membershipNumber))])).rows;
}
export async function matchMember(db: DB, input: MemberInput,candidates?:MatchRow[]): Promise<Match | null> {
  const rows:MatchRow[] = candidates ? candidates.filter(r=>r.contact_email?.trim().toLowerCase()===input.email || r.membership_number && membershipKey(r.membership_number)===membershipKey(input.membershipNumber)) : (await db.query(
    `SELECT p.id,p.version,p.accepted,p.contact_email,m.id AS membership_id,m.version AS membership_version,m.membership_number,m.type,m.status,m.valid_from,m.valid_until
     FROM tpa.people p LEFT JOIN tpa.memberships m ON m.person_id=p.id
     WHERE lower(btrim(p.contact_email))=$1 OR lower(regexp_replace(btrim(m.membership_number),'[[:space:]]+',' ','g'))=$2`,
    [input.email, membershipKey(input.membershipNumber)],
  )).rows;
  if (!rows.length) return null;
  if (rows.length !== 1)
    throw new OperationError("Email and membership number identify different records.", 409, "identity_conflict");
  const row = rows[0];
  if (row.contact_email?.trim().toLowerCase() !== input.email || membershipKey(row.membership_number ?? "") !== membershipKey(input.membershipNumber))
    throw new OperationError("Both email and membership number must match an existing member before an import update.", 409, "identity_conflict");
  return { personId: row.id, personVersion: row.version, membershipVersion: row.membership_version, body: row.accepted, membership: row };
}
export function memberFromBody(body: PersonBody, number: string): MemberInput {
  return {
    prefix: body.prefix ?? "", firstName: body.firstName ?? "", lastName: body.lastName ?? "",
    email: body.email ?? "", mobile: body.mobile ?? body.phone ?? "", designation: body.jobTitle ?? "",
    organization: body.organization ?? "", membershipNumber: number, addresses: body.addresses ?? {},
  };
}
export async function provisionMemberAccount(c: PoolClient, personId: string, input: MemberInput) {
  const person = (await c.query("SELECT user_id FROM tpa.people WHERE id=$1 FOR UPDATE", [personId])).rows[0];
  if (person.user_id) return { accountId: person.user_id, invitationQueued: false };
  const found = (await c.query('SELECT id FROM public."user" WHERE lower(btrim(email))=$1 FOR UPDATE', [input.email])).rows[0];
  let accountId = found?.id;
  if (accountId) {
    // Never replace a working person record or grant access by email matching alone.
    throw new OperationError("An existing account needs explicit administrator linking before provisioning.", 409, "account_link_required");
  }
  const created=await createInvitedAccount(c,{name:memberDisplayName(input),email:input.email});
  if(!created) throw new OperationError("An account was created concurrently. Preview again before linking.",409,"account_link_required");
  accountId=created.accountId;
  await c.query("UPDATE tpa.people SET user_id=$2 WHERE id=$1", [personId,accountId]);
  return { accountId, invitationQueued: true };
}
function membershipDetails(raw: Record<string, unknown>) {
  const type = raw.type ?? null, status = raw.status ?? null;
  if (type !== null && !["Annual","Life","Patron"].includes(String(type))) throw new OperationError("Check membership type.");
  if (status !== null && !["active","expired","suspended","resigned"].includes(String(status))) throw new OperationError("Check membership status.");
  const date = (key: string) => {
    const v = raw[key] ?? null;
    if (v !== null && (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v+"T00:00:00Z")) || new Date(v+"T00:00:00Z").toISOString().slice(0,10) !== v)) throw new OperationError("Check membership dates.");
    return v;
  };
  const from = date("validFrom"), until = date("validUntil");
  if (from && until && String(until) < String(from)) throw new OperationError("Validity end must follow its start.");
  return { type,status,from,until };
}
export async function saveMember(c: PoolClient, actorId: string, raw: Record<string, unknown>, source: "staff" | "import" = "staff"): Promise<{personId:string;status:"created"|"updated";accountId?:string;invitationQueued?:boolean;warnings:string[]}> {
  if(raw.provisionAccount!==undefined && typeof raw.provisionAccount!=="boolean") throw new OperationError("Check account provisioning option.",400,"member_validation",{provisionAccount:"Use true or false."});
  const personId = typeof raw.personId === "string" ? raw.personId : null;
  const row = personId ? (await c.query("SELECT * FROM tpa.people WHERE id::text=$1 FOR UPDATE", [personId])).rows[0] : null;
  if (personId && !row) throw new OperationError("Member not found.",404,"member_not_found");
  const supplied=raw.member as Record<string,unknown> | undefined;
  const unchangedMobile=!!row && supplied?.mobile===(row.accepted.mobile ?? row.accepted.phone);
  const unchangedPrefix=!!row && supplied?.prefix===row.accepted.prefix;
  const unchangedAddresses=!!row && isDeepStrictEqual(supplied?.addresses,row.accepted.addresses);
  const input=memberInput(supplied && {...supplied,...(unchangedMobile?{mobile:undefined}:{}),...(unchangedPrefix?{prefix:undefined}:{}),...(unchangedAddresses?{addresses:undefined}:{})});
  if(unchangedMobile) input.mobile=String(supplied!.mobile ?? "");
  if(unchangedPrefix) input.prefix=String(supplied!.prefix ?? "");
  if(unchangedAddresses) input.addresses=row.accepted.addresses ?? {};
  const membership = row ? (await c.query("SELECT * FROM tpa.memberships WHERE person_id=$1 FOR UPDATE", [row.id])).rows[0] : null;
  if (row && (row.version !== raw.personVersion || (membership?.version ?? 0) !== raw.membershipVersion)) throw new OperationError("Member changed. Preview or reload again.",409,"stale_member");
  if (row) {
    // Avoid overwriting a pending profile workflow while importing the register.
    if (row.status === "pending" || JSON.stringify(row.accepted) !== JSON.stringify(row.draft)) throw new OperationError("Member has an unsaved or pending profile review. Resolve it first.",409,"profile_review_conflict");
    const collision = (await c.query("SELECT id FROM tpa.people WHERE lower(btrim(contact_email))=$1 AND id<>$2", [input.email,row.id])).rowCount;
    if (collision) throw new OperationError("Email belongs to another person.",409,"identity_conflict");
  }
  input.addresses = await validateAddresses(c,input.addresses,row?.accepted.addresses ?? {});
  if (!row && (await c.query('SELECT 1 FROM public."user" WHERE lower(btrim(email))=$1',[input.email])).rowCount)
    throw new OperationError("An account already exists for this email. Add membership to its existing person using an explicit update.",409,"account_link_required");
  const id = row?.id ?? randomUUID();
  const warnings=source==="staff" && input.mobile && (await c.query("SELECT 1 FROM tpa.people WHERE mobile_normalized=$1 AND id<>$2 LIMIT 1",[input.mobile,id])).rowCount ? ["Mobile is already used by another person; review identity. Shared numbers are allowed."] : [];
  const body = personBody({ ...row?.accepted, name: memberDisplayName(input,row?.accepted),
    prefix: input.prefix, firstName: input.firstName,lastName: input.lastName,email: input.email,mobile: input.mobile,
    phone: input.mobile,organization: input.organization,jobTitle: input.designation,addresses: input.addresses });
  const baseline = membership ? {type:membership.type,status:membership.status,validFrom:membership.valid_from?.toISOString?.().slice(0,10) ?? membership.valid_from,validUntil:membership.valid_until?.toISOString?.().slice(0,10) ?? membership.valid_until} : {};
  if(raw.membership!==undefined && (!raw.membership || typeof raw.membership!=="object" || Array.isArray(raw.membership))) throw new OperationError("Check membership details.");
  const detail = membershipDetails({...baseline,...(raw.membership as Record<string,unknown> ?? {})});
  if (row) await c.query("UPDATE tpa.people SET accepted=$2,draft=$2,contact_email=$3,mobile_normalized=$4,version=version+1,updated_at=now() WHERE id=$1", [id,body,input.email,unchangedMobile ? row.mobile_normalized : input.mobile || null]);
  else await c.query("INSERT INTO tpa.people(id,accepted,draft,contact_email,mobile_normalized) VALUES($1,$2,$2,$3,$4)", [id,body,input.email,input.mobile || null]);
  await c.query("INSERT INTO tpa.memberships(id,person_id,membership_number,type,status,valid_from,valid_until,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(person_id) DO UPDATE SET membership_number=$3,type=$4,status=$5,valid_from=$6,valid_until=$7,version=tpa.memberships.version+1,updated_at=now()", [membership?.id ?? randomUUID(),id,input.membershipNumber,detail.type,detail.status,detail.from,detail.until,source]);
  if (row?.user_id) await c.query("UPDATE tpa.member_profiles SET phone=$2,organization=$3,job_title=$4,updated_at=now() WHERE user_id=$1", [row.user_id,input.mobile,input.organization,input.designation]);
  await c.query("INSERT INTO tpa.person_revisions(id,person_id,version,action,body,actor_id) SELECT $1,id,version,$3,$4,$5 FROM tpa.people WHERE id=$2", [randomUUID(),id,"member."+(row ? "updated" : "created"),body,actorId]);
  await audit(c,actorId,"member."+(row ? "updated" : "created"),id);
  const account = raw.provisionAccount === true ? await provisionMemberAccount(c,id,input) : {};
  return { personId:id,...account,warnings, status: row ? "updated" : "created" };
}
