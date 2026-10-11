import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool,type PoolClient} from 'pg';
import {databaseOptions} from '../src/lib/database-options';
import {createMemberPreview,memberBatchAction} from '../src/lib/member-import';
import {enqueueMemberJob,claimMemberJob,processMemberChunk,getMemberJob,retryMemberJob} from '../src/lib/member-import-jobs';
import {memberHeaders,extendedMemberHeaders,correctionMemberHeaders} from '../src/domain/member-import';
import {diagnoseMembers} from '../src/lib/member-import-diagnostic';
import {saveMember} from '../src/lib/member-register';
const enabled=process.env.TPA_DATABASE_NAME?.startsWith('tpa_onboarding_test_jobs_'),pool=new Pool(databaseOptions()),actor=randomUUID();
before(async()=>{if(!enabled)return;
 await pool.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Synthetic import operator\',$2,true)',[actor,actor+'@example.invalid']);
 await pool.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",[actor]);
 await pool.query("INSERT INTO tpa.postal_versions(id,source_url,source_sha256,active) VALUES('fixture','https://example.invalid/reference','synthetic',true)");
 await pool.query("INSERT INTO tpa.postal_locations(version_id,pin,state,district,locality) VALUES('fixture','700001','West Bengal','Kolkata','Kolkata GPO'),('fixture','700002','West Bengal','Kolkata','North'),('fixture','700002','West Bengal','Howrah','Other')");
 await pool.query("INSERT INTO tpa.postal_city_aliases(version_id,state,district,alias,city) VALUES('fixture','West Bengal','Kolkata','Kolkata','Kolkata')");
});
after(async()=>{await pool.end();});
async function transaction<T>(fn:(c:PoolClient)=>Promise<T>){const c=await pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
function data(n:number,key=randomUUID()){return [memberHeaders,...Array.from({length:n},(_,i)=>['CA','Synthetic','Member'+i,key+'-'+String(i).padStart(5,'0'),key+'-'+i+'@example.invalid','9876543210','','','','','','',''])];}
async function preview(cells:string[][],sourceRows?:number[]){return transaction(c=>createMemberPreview(c,actor,cells,sourceRows,undefined,true));}
async function enqueue(batch:{id:string;version:number}){return transaction(c=>enqueueMemberJob(c,actor,{batchId:batch.id,version:batch.version}));}
async function finish(id:string){for(let i=0;i<100;i++){const claim=await claimMemberJob(pool,'test-worker');assert.ok(claim);assert.equal(claim.id,id);await processMemberChunk(pool,claim);const job=await getMemberJob(pool,actor,id);if(job.state.startsWith('completed'))return job;}throw Error('Job did not finish');}
async function protectedCounts(){return (await pool.query(`SELECT (SELECT count(*) FROM public."user") accounts,(SELECT count(*) FROM public."account") credentials,(SELECT count(*) FROM tpa.onboarding_invitations) invitations,(SELECT count(*) FROM tpa.onboarding_mail) mail`)).rows[0];}
test('10, 50 and 250 members commit durable chunks and repeated jobs/files never duplicate or invite',{skip:!enabled},async()=>{
 const protectedBefore=await protectedCounts();
 for(const size of [10,50,250]){
  const cells=data(size);if(size===10){cells[0]=extendedMemberHeaders;for(const r of cells.slice(1))r.push('','');Object.assign(cells[1],{8:'12 Road',9:'India',10:'West Bengal',11:'Kolkata',12:'700001',13:'Kolkata',14:'Kolkata GPO'});}
  const batch=await preview(cells),job=await enqueue(batch);assert.equal((await enqueue(batch)).id,job.id);
  await assert.rejects(transaction(c=>memberBatchAction(c,actor,{action:'commit',id:batch.id,version:1})),/durable import job/);
  const outcome=await finish(job.id);assert.equal(outcome.totals.created,size);assert.equal(outcome.processed,size);
  const again=await enqueue(await preview(cells)),repeated=await finish(again.id);assert.equal(repeated.totals.skipped,size);assert.equal(repeated.totals.created,0);
  const numbers=cells.slice(1).map(r=>r[3]);const audit=(await pool.query('SELECT m.membership_number,p.contact_email,p.mobile_normalized,p.accepted,p.user_id,m.person_id FROM tpa.memberships m JOIN tpa.people p ON p.id=m.person_id WHERE m.membership_number=ANY($1::text[]) ORDER BY m.membership_number',[numbers])).rows;
  assert.equal(audit.length,size);assert.equal(new Set(audit.map(r=>r.membership_number)).size,size);assert.equal(new Set(audit.map(r=>r.contact_email)).size,size);
  for(const index of [0,Math.floor(size/2),size-1]){assert.ok(audit[index].person_id);assert.equal(audit[index].user_id,null);assert.equal(audit[index].mobile_normalized,'+919876543210');}
  if(size===10) assert.equal(audit[0].accepted.addresses.correspondence.district,'Kolkata');
  console.log(JSON.stringify({size,created:outcome.totals.created,repeatedSkipped:repeated.totals.skipped}));
 }
 assert.deepEqual(await protectedCounts(),protectedBefore);
});
test('mixed invalid/conflict rows and membership failure keep original rows, roll back identities and allow correction',{skip:!enabled},async()=>{
 const cells=data(10),key=randomUUID();cells[1][4]='bad';cells[2][4]=cells[3][4];cells[4][5]='bad';cells[5][3]=key+'-fail';
 const physical=[1,...Array.from({length:10},(_,i)=>3+i*2)];
 const batch=await preview(cells,physical);
 await pool.query(`CREATE FUNCTION tpa.synthetic_membership_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.membership_number LIKE '%-fail' THEN RAISE EXCEPTION 'synthetic failure' USING ERRCODE='22000'; END IF; RETURN NEW; END $$`);
 await pool.query('CREATE TRIGGER synthetic_membership_failure BEFORE INSERT ON tpa.memberships FOR EACH ROW EXECUTE FUNCTION tpa.synthetic_membership_failure()');
 try {const result=await finish((await enqueue(batch)).id);assert.equal(result.totals.invalid,2);assert.equal(result.totals.conflict,2);assert.equal(result.totals.failed,1);assert.equal(result.totals.created,5);
  assert.deepEqual(result.rows.map((r:{sourceRow:number})=>r.sourceRow),physical.slice(1));assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.people WHERE contact_email=$1',[cells[5][4]])).rows[0].n,0);
  await assert.rejects(transaction(c=>retryMemberJob(c,actor,result.id)),/No transient/);
 }finally{await pool.query('DROP TRIGGER synthetic_membership_failure ON tpa.memberships');await pool.query('DROP FUNCTION tpa.synthetic_membership_failure()');}
 const corrected=[correctionMemberHeaders,[...cells[5],'','','11','a'.repeat(64)]];const correction=await preview(corrected);
 const result=await finish((await enqueue(correction)).id);assert.equal(result.totals.created,1);assert.equal(result.rows[0].sourceRow,11);
});
test('leases fence stale workers; concurrent claims recover after restart and retries never repeat successful rows',{skip:!enabled},async()=>{
 const batch=await preview(data(6)),job=await enqueue(batch);
 const claims=await Promise.all([claimMemberJob(pool,'one'),claimMemberJob(pool,'two')]);assert.equal(claims.filter(Boolean).length,1);const old=claims.find(Boolean)!;
 await pool.query("UPDATE tpa.member_import_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[job.id]);
 const current=await claimMemberJob(pool,'replacement');assert.ok(current);await assert.rejects(processMemberChunk(pool,old),/lease lost/);
 assert.equal((await getMemberJob(pool,actor,job.id)).processed,0);await processMemberChunk(pool,current);const result=await finish(job.id);assert.equal(result.totals.created,6);
 // Create a real retryable row failure after person insertion and prove savepoint rollback.
 const retryCells=data(2);retryCells[1][3]+='-retry';const retryJob=await enqueue(await preview(retryCells));
 await pool.query(`CREATE FUNCTION tpa.synthetic_retry_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.membership_number LIKE '%-retry' THEN RAISE EXCEPTION 'synthetic transient' USING ERRCODE='40001'; END IF; RETURN NEW; END $$`);
 await pool.query('CREATE TRIGGER synthetic_retry_failure BEFORE INSERT ON tpa.memberships FOR EACH ROW EXECUTE FUNCTION tpa.synthetic_retry_failure()');
 try{for(let attempt=0;attempt<4;attempt++){await pool.query("UPDATE tpa.member_import_job_rows SET available_at=now() WHERE job_id=$1 AND status='retry'",[retryJob.id]);const claim=await claimMemberJob(pool,'retry-worker');assert.ok(claim);await processMemberChunk(pool,claim);}
  const exhausted=await getMemberJob(pool,actor,retryJob.id);assert.equal(exhausted.totals.failed,1);assert.equal(exhausted.totals.created,1);assert.equal(exhausted.rows[0].attempts,4);
  assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.people WHERE contact_email=$1',[retryCells[1][4]])).rows[0].n,0);
 }finally{await pool.query('DROP TRIGGER synthetic_retry_failure ON tpa.memberships');await pool.query('DROP FUNCTION tpa.synthetic_retry_failure()');}
 await transaction(c=>retryMemberJob(c,actor,retryJob.id));const retried=await finish(retryJob.id);assert.equal(retried.totals.created,2);assert.equal(retried.rows[1].attempts,1);
});
test('diagnostic collects secondary address issues, duplicate groups and blocked checks without personal inference',{skip:!enabled},async()=>{
 const cells=data(3);cells[1][4]=cells[2][4];Object.assign(cells[1],{9:'India',10:'West Bengal',11:'Unsupported city',12:'700002'});Object.assign(cells[3],{8:'Road',9:'India',10:'Wrong State',11:'Kolkata',12:'700001'});
 const result=await diagnoseMembers(pool,cells);const codes=result.rows[0].issues.map(i=>i.code);
 for(const code of ['duplicate_email','address_completeness','missing_district','postal_ambiguity','unsupported_reference_value'])assert.ok(codes.includes(code));
 assert.equal(result.rows[0].normalized.District,'');assert.ok(result.rows[2].issues.some(i=>i.code==='dependent_check_blocked'));assert.equal(result.source,3);
 await assert.rejects(transaction(c=>enqueueMemberJob(c,actor,{batchId:randomUUID(),version:1,provisionAccounts:true})),/cannot provision/);
});
test('individual creation racing a durable row retains one person and membership with an explicit outcome',{skip:!enabled},async()=>{
 const cells=data(2),batch=await preview(cells),job=await enqueue(batch),claim=await claimMemberJob(pool,'race-worker');assert.ok(claim);
 const member=batch.rows[0].member!;
 await Promise.allSettled([processMemberChunk(pool,claim),transaction(c=>saveMember(c,actor,{member,provisionAccount:false},'import'))]);
 const outcome=await getMemberJob(pool,actor,job.id);
 assert.ok(['created','skipped','conflict'].includes(outcome.rows[0].status));
 assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.people WHERE contact_email=$1',[member.email])).rows[0].n,1);
 assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.memberships WHERE membership_number=$1',[member.membershipNumber])).rows[0].n,1);
});
