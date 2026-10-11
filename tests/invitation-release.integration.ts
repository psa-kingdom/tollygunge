import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Pool,type PoolClient} from 'pg';
import {databaseOptions} from '../src/lib/database-options';import {invitationTemplateState,invitationTemplateAction,createInvitationReview,confirmInvitationReview} from '../src/lib/invitation-release';import {invitationDefaults} from '../src/domain/invitation-template';import {createInvitedAccount} from '../src/lib/account-provisioning';import {openMail} from '../src/lib/onboarding-mail';
const enabled=process.env.TPA_DATABASE_NAME?.startsWith('tpa_onboarding_test_invitations_'),pool=new Pool(databaseOptions()),actor=randomUUID();
async function tx<T>(fn:(c:PoolClient)=>Promise<T>){const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
before(async()=>{if(enabled)await pool.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Synthetic administrator\',$2,true)',[actor,actor+'@example.invalid']);});after(()=>pool.end());
async function fixtures(size:number){const records=Array.from({length:size},(_,n)=>({user_id:randomUUID(),person_id:randomUUID(),membership_id:randomUUID(),email:randomUUID()+'@example.invalid',name:'Synthetic member '+n,number:randomUUID()}));
 await tx(async c=>{await c.query('INSERT INTO public."user"(id,name,email,"emailVerified") SELECT user_id,name,email,false FROM jsonb_to_recordset($1::jsonb) AS x(user_id text,name text,email text)',[JSON.stringify(records)]);
 await c.query("INSERT INTO tpa.people(id,user_id,accepted,draft,contact_email) SELECT person_id,user_id,jsonb_build_object('name',name),jsonb_build_object('name',name),email FROM jsonb_to_recordset($1::jsonb) AS x(person_id uuid,user_id text,name text,email text)",[JSON.stringify(records)]);
 await c.query("INSERT INTO tpa.memberships(id,person_id,membership_number,source) SELECT membership_id,person_id,number,'staff' FROM jsonb_to_recordset($1::jsonb) AS x(membership_id uuid,person_id uuid,number text)",[JSON.stringify(records)]);
 await c.query('INSERT INTO tpa.account_invitation_holds(user_id) SELECT user_id FROM jsonb_to_recordset($1::jsonb) AS x(user_id text)',[JSON.stringify(records)]);});return records;
}
async function approved(){const state=await invitationTemplateState(pool);const saved=await tx(c=>invitationTemplateAction(c,actor,{action:'save',revision:state.revision,...invitationDefaults}));return tx(c=>invitationTemplateAction(c,actor,{action:'approve',id:saved.latest_id,revision:saved.revision}));}
test('new accounts and draft/approval do not create tokens or mail; edits invalidate approvals',{skip:!enabled},async()=>{
 const created=await tx(c=>createInvitedAccount(c,{name:'Held account',email:randomUUID()+'@example.invalid'}));assert.equal(created?.invitationQueued,false);
 assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.onboarding_invitations')).rows[0].n,0);assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.onboarding_mail')).rows[0].n,0);
 const members=await fixtures(1);await assert.rejects(tx(c=>createInvitationReview(c,actor,{personIds:[members[0].person_id]})),/Approve/);
 const ready=await approved();assert.ok(ready.approved_id);assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.onboarding_mail')).rows[0].n,0);
 const first=await tx(c=>createInvitationReview(c,actor,{personIds:[members[0].person_id]}));
 const draft=await tx(c=>invitationTemplateAction(c,actor,{action:'save',revision:ready.revision,...invitationDefaults,subject:'Updated invitation'}));assert.equal(draft.approved_id,null);
 await assert.rejects(tx(c=>confirmInvitationReview(c,actor,{id:first.id,idempotencyKey:first.idempotency_key})),/Template changed/);
 await assert.rejects(tx(c=>invitationTemplateAction(c,actor,{action:'approve',id:draft.latest_id,revision:ready.revision})),/Template changed/);
 await approved();
});
test('10, 50 and 202 reviewed recipients queue atomically, replay safely and retain credentials',{skip:!enabled},async()=>{
 const before=(await pool.query('SELECT count(*)::int n FROM public."account"')).rows[0].n;
 for(const size of [10,50,202]){const members=await fixtures(size),ids=members.map(r=>r.person_id),review=await tx(c=>createInvitationReview(c,actor,{personIds:ids}));
 const started=Date.now();const results=await tx(c=>confirmInvitationReview(c,actor,{id:review.id,idempotencyKey:review.idempotency_key}));assert.equal(results.results.length,size);
 assert.equal((await tx(c=>confirmInvitationReview(c,actor,{id:review.id,idempotencyKey:review.idempotency_key}))).results.length,size);
 const mail=(await pool.query('SELECT payload,user_id FROM tpa.onboarding_mail WHERE user_id=ANY($1::text[])',[members.map(r=>r.user_id)])).rows;assert.equal(mail.length,size);
 for(const record of mail){const payload=openMail(record.payload);assert.ok(payload.text.includes('/invitation#token='));assert.ok(payload.text.includes('48 hours'));}
 assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.onboarding_invitations WHERE user_id=ANY($1::text[]) AND expires_at>now()+interval \'47 hours\'',[members.map(r=>r.user_id)])).rows[0].n,size);
 assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.account_invitation_holds WHERE user_id=ANY($1::text[]) AND released_at IS NULL',[members.map(r=>r.user_id)])).rows[0].n,0);
 console.log(JSON.stringify({reviewed:size,queued:size,replayAdditionalMail:0,confirmMs:Date.now()-started}));}
 assert.equal((await pool.query('SELECT count(*)::int n FROM public."account"')).rows[0].n,before);
});
test('stale recipient and expired preview reject; a mail insertion failure rolls back tokens and holds',{skip:!enabled},async()=>{
 const members=await fixtures(2),review=await tx(c=>createInvitationReview(c,actor,{personIds:members.map(r=>r.person_id)}));
 await pool.query('UPDATE tpa.people SET version=version+1 WHERE id=$1',[members[0].person_id]);await assert.rejects(tx(c=>confirmInvitationReview(c,actor,{id:review.id,idempotencyKey:review.idempotency_key})),/Recipients changed/);
 const expired=await tx(c=>createInvitationReview(c,actor,{personIds:members.map(r=>r.person_id)}));await pool.query("UPDATE tpa.invitation_release_reviews SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);await assert.rejects(tx(c=>confirmInvitationReview(c,actor,{id:expired.id,idempotencyKey:expired.idempotency_key})),/expired/);
 const fresh=await tx(c=>createInvitationReview(c,actor,{personIds:members.map(r=>r.person_id)}));
 await pool.query("CREATE FUNCTION tpa.synthetic_invitation_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic mail failure'; END $$");await pool.query('CREATE TRIGGER synthetic_invitation_failure BEFORE INSERT ON tpa.onboarding_mail FOR EACH STATEMENT EXECUTE FUNCTION tpa.synthetic_invitation_failure()');
 try{await assert.rejects(tx(c=>confirmInvitationReview(c,actor,{id:fresh.id,idempotencyKey:fresh.idempotency_key})),/synthetic mail failure/);}finally{await pool.query('DROP TRIGGER synthetic_invitation_failure ON tpa.onboarding_mail');await pool.query('DROP FUNCTION tpa.synthetic_invitation_failure()');}
 assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.onboarding_invitations WHERE user_id=ANY($1::text[])',[members.map(r=>r.user_id)])).rows[0].n,0);
 assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.account_invitation_holds WHERE user_id=ANY($1::text[]) AND released_at IS NULL',[members.map(r=>r.user_id)])).rows[0].n,2);
 const both=await Promise.allSettled([tx(c=>confirmInvitationReview(c,actor,{id:fresh.id,idempotencyKey:fresh.idempotency_key})),tx(c=>confirmInvitationReview(c,actor,{id:fresh.id,idempotencyKey:fresh.idempotency_key}))]);assert.equal(both.filter(r=>r.status==='fulfilled').length,2);assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.onboarding_mail WHERE user_id=ANY($1::text[])',[members.map(r=>r.user_id)])).rows[0].n,2);
});
