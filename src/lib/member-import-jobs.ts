import 'server-only';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import type {Pool,PoolClient} from 'pg';
import type {MemberRow} from '@/domain/member-import';
import {memberInput,MemberValidationError} from '@/domain/member-foundation';
import {strictMemberJobPolicy,transientImportError,memberJobTotals} from '@/domain/member-import-job';
import {OperationError} from './operation-error';
import {audit} from './operation-audit';
import {memberFromBody,matchMember,saveMember} from './member-register';
import {importUpdate} from './member-import';
import {validateAddresses} from './member-address';

type Claim={id:string;actor_id:string;generation:number;lease_owner:string;policy:unknown};
export async function enqueueMemberJob(c:PoolClient,actorId:string,input:Record<string,unknown>) {
 if(input.provisionAccounts || input.provisionAccount || input.invitationDelivery || input.updateRows!==undefined)
  throw new OperationError('Member jobs cannot provision accounts, invite or update records.',400,'member_job_policy');
 const b=(await c.query("SELECT * FROM tpa.onboarding_batches WHERE id::text=$1 AND actor_id=$2 FOR UPDATE",[input.batchId,actorId])).rows[0];
 if(!b) throw new OperationError('Preview not found.',404);
 if(b.mode!=='members' || b.choices?.approval || !b.choices?.preserveExisting || b.choices.allowDistrictDerivation!==false || b.choices.provisionAccounts || b.choices.updateRows?.length)
  throw new OperationError('Review a strict preservation member preview before enqueueing.',409,'member_job_policy');
 if(input.version!==b.version) throw new OperationError('Preview choices changed. Reload.',409,'stale_batch');
 const existing=(await c.query('SELECT id FROM tpa.member_import_jobs WHERE batch_id=$1 AND batch_version=$2',[b.id,b.version])).rows[0];
 if(existing) return {id:existing.id,duplicate:true,statusUrl:'/api/staff/member-import-jobs?id='+existing.id};
 if(b.committed_at || b.results?.length) throw new OperationError('This batch already has synchronous results. Create a fresh preview.',409,'batch_started');
 const id=randomUUID();
 await c.query('INSERT INTO tpa.member_import_jobs(id,batch_id,batch_version,actor_id,source_hash,policy) VALUES($1,$2,$3,$4,$5,$6)',[id,b.id,b.version,actorId,b.source_hash,JSON.stringify(strictMemberJobPolicy)]);
 await c.query(`INSERT INTO tpa.member_import_job_rows(job_id,source_row,ordinal,input)
 SELECT $1,(value->>'sourceRow')::integer,ordinality::integer,value FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY`,[id,JSON.stringify(b.rows)]);
 await audit(c,actorId,'members.job_queued',id);
 return {id,duplicate:false,statusUrl:'/api/staff/member-import-jobs?id='+id};
}
export async function getMemberJob(db:Pick<Pool,'query'>,actorId:string,id:string) {
 const job=(await db.query('SELECT * FROM tpa.member_import_jobs WHERE id::text=$1 AND actor_id=$2',[id,actorId])).rows[0];
 if(!job) throw new OperationError('Import job not found.',404);
 const rows=(await db.query('SELECT source_row AS "sourceRow",status,attempts,available_at,result FROM tpa.member_import_job_rows WHERE job_id=$1 ORDER BY ordinal',[job.id])).rows;
 const worker=(await db.query("SELECT heartbeat_at,enabled FROM tpa.member_import_worker_state WHERE id='member-import'")).rows[0]??null;
 return {...job,rows,totals:memberJobTotals(rows),processed:rows.filter(r=>!['pending','retry'].includes(r.status)).length,total:rows.length,worker};
}
export async function retryMemberJob(c:PoolClient,actorId:string,id:unknown) {
 const job=(await c.query('SELECT * FROM tpa.member_import_jobs WHERE id::text=$1 AND actor_id=$2 FOR UPDATE',[id,actorId])).rows[0];
 if(!job) throw new OperationError('Import job not found.',404);
 if(!['completed-with-issues','paused'].includes(job.state)) throw new OperationError('Finish the running import before retrying.',409,'job_running');
 const reset=await c.query("UPDATE tpa.member_import_job_rows SET status='retry',attempts=0,available_at=now() WHERE job_id=$1 AND status='failed' AND result->>'retryable'='true'",[job.id]);
 if(!reset.rowCount) throw new OperationError('No transient failures to retry. Correct invalid or conflicting source rows in a new preview.',400,'no_retryable_rows');
 await c.query("UPDATE tpa.member_import_jobs SET state='queued',completed_at=NULL,lease_owner=NULL,lease_until=NULL,generation=generation+1 WHERE id=$1",[job.id]);
 await audit(c,actorId,'members.job_retried',job.id);return {id:job.id,retried:reset.rowCount};
}
export async function claimMemberJob(pool:Pool,owner:string):Promise<Claim|null> {
 const c=await pool.connect();
 try {await c.query('BEGIN');
 // Exactly one active job across all workers; expired claims may be recovered.
 await c.query('SELECT pg_advisory_xact_lock(74672028)');
 const active=(await c.query("SELECT 1 FROM tpa.member_import_jobs WHERE state='running' AND lease_until>now() LIMIT 1")).rowCount;
 if(active){await c.query('COMMIT');return null;}
 const row=(await c.query(`SELECT id FROM tpa.member_import_jobs j WHERE (state='queued' OR state='running' AND lease_until<=now())
 AND (NOT EXISTS(SELECT 1 FROM tpa.member_import_job_rows r WHERE r.job_id=j.id AND r.status IN ('pending','retry'))
 OR EXISTS(SELECT 1 FROM tpa.member_import_job_rows r WHERE r.job_id=j.id AND r.status IN ('pending','retry') AND available_at<=now()))
 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`)).rows[0];
 if(!row){await c.query('COMMIT');return null;}
 const claimed=(await c.query("UPDATE tpa.member_import_jobs SET state='running',generation=generation+1,lease_owner=$2,lease_until=now()+interval '2 minutes',heartbeat_at=now() WHERE id=$1 RETURNING id,actor_id,generation,lease_owner,policy",[row.id,owner])).rows[0];
 await c.query('COMMIT');return claimed;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
async function processRow(c:PoolClient,actorId:string,row:MemberRow) {
 if(row.status==='failed') return {status:'invalid',reason:row.reason,fieldErrors:row.fieldErrors,retryable:false};
 if(row.status==='conflict') return {status:'conflict',reason:row.reason,fieldErrors:row.fieldErrors,retryable:false};
 if(!row.member) throw new MemberValidationError({row:'Member input is missing.'});
 const input=memberInput(row.member);
 for(const [kind,address] of Object.entries(input.addresses)) if(address.country==='IN' && Object.values(address).some(Boolean) && !address.district)
  return {status:'conflict',reason:'District is missing; authoritative correction required.',fieldErrors:{['addresses.'+kind+'.district']:'Missing district; no derivation is permitted.'},retryable:false};
 input.addresses=await validateAddresses(c,input.addresses);
 const match=await matchMember(c,input);
 if(row.match && (!match || match.personId!==row.match.personId || match.personVersion!==row.match.personVersion || match.membershipVersion!==row.match.membershipVersion))
  throw new OperationError('Member changed since preview. Create a fresh preview.',409,'stale_member');
 if(match){const previous=memberFromBody(match.body,String(match.membership.membership_number));
  if(!isDeepStrictEqual(previous,importUpdate(previous,input))) throw new OperationError('Existing member differs; no overwrite is permitted.',409,'identity_conflict');
  return {status:'skipped',personId:match.personId,reason:'Exact existing member; no changes.',retryable:false};}
 const saved=await saveMember(c,actorId,{member:input,provisionAccount:false},'import');
 return {...saved,status:'created',retryable:false};
}
export async function processMemberChunk(pool:Pool,claim:Claim) {
 if(!isDeepStrictEqual(claim.policy,strictMemberJobPolicy)) throw new OperationError('Unsupported immutable member-job policy.',409,'member_job_policy');
 const c=await pool.connect();const started=Date.now();
 try {await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='10s'");await c.query("SET LOCAL lock_timeout='3s'");
 const rows=(await c.query("SELECT * FROM tpa.member_import_job_rows WHERE job_id=$1 AND status IN ('pending','retry') AND available_at<=now() ORDER BY ordinal LIMIT 5 FOR UPDATE",[claim.id])).rows;
 for(const stored of rows){await c.query('SAVEPOINT import_row');let result:Record<string,unknown>,status:string,delay=0;
  try{result=await processRow(c,claim.actor_id,stored.input);status=String(result.status);}
  catch(e){await c.query('ROLLBACK TO SAVEPOINT import_row');const error=e as {code?:string};const retryable=transientImportError(error.code);
   const attempts=stored.attempts+1;status=retryable && attempts<=3?'retry':e instanceof MemberValidationError?'invalid':e instanceof OperationError && e.status===409 || error.code==='23505'?'conflict':'failed';
   delay=retryable && attempts<=3?[5,30,120][attempts-1]:0;
   result={status,retryable,code:e instanceof MemberValidationError?e.code:error.code==='23505'?'duplicate_conflict':error.code??'creation_failed',reason:e instanceof MemberValidationError?'Correct the invalid member fields.':e instanceof OperationError?e.message:error.code==='23505'?'Email or membership number was claimed concurrently. Re-preview the row.':retryable?'Temporary database failure; safe retry pending.':'Creation failed; no partial records retained.',...(e instanceof MemberValidationError?{fieldErrors:e.fieldErrors}:{})};
  }finally{await c.query('RELEASE SAVEPOINT import_row');}
  await c.query("UPDATE tpa.member_import_job_rows SET status=$3,attempts=attempts+1,result=$4,available_at=now()+$5*interval '1 second',updated_at=now() WHERE job_id=$1 AND source_row=$2",[claim.id,stored.source_row,status,JSON.stringify({...result,sourceRow:stored.source_row,email:stored.input.email,membershipNumber:stored.input.membershipNumber}),delay]);
 }
 // Fencing check shares the transaction with every member and result write.
 const fenced=await c.query("UPDATE tpa.member_import_jobs SET heartbeat_at=now(),last_progress_at=CASE WHEN $4 THEN now() ELSE last_progress_at END,lease_until=now()+interval '2 minutes' WHERE id=$1 AND generation=$2 AND lease_owner=$3 AND state='running' AND lease_until>now() RETURNING id",[claim.id,claim.generation,claim.lease_owner,rows.length>0]);
 if(!fenced.rowCount) throw new OperationError('Worker lease lost; chunk rolled back.',409,'lease_lost');
 const pending=(await c.query("SELECT count(*)::int n FROM tpa.member_import_job_rows WHERE job_id=$1 AND status IN ('pending','retry')",[claim.id])).rows[0].n;
 if(!pending){const issues=(await c.query("SELECT count(*)::int n FROM tpa.member_import_job_rows WHERE job_id=$1 AND status IN ('conflict','invalid','failed')",[claim.id])).rows[0].n;
  await c.query("UPDATE tpa.member_import_jobs SET state=$2,completed_at=now(),lease_owner=NULL,lease_until=NULL WHERE id=$1",[claim.id,issues?'completed-with-issues':'completed']);
  await c.query("UPDATE tpa.onboarding_batches SET committed_at=now(),results=(SELECT coalesce(jsonb_agg(result ORDER BY ordinal),'[]') FROM tpa.member_import_job_rows WHERE job_id=$1) WHERE id=(SELECT batch_id FROM tpa.member_import_jobs WHERE id=$1)",[claim.id]);
  await audit(c,claim.actor_id,'members.job_completed',claim.id);
 }else await c.query("UPDATE tpa.member_import_jobs SET state='queued',lease_owner=NULL,lease_until=NULL WHERE id=$1",[claim.id]);
 await c.query('COMMIT');return {processed:rows.length,elapsedMs:Date.now()-started,complete:!pending};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
