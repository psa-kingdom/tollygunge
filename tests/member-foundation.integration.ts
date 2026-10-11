import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import { saveMember,matchMember } from "../src/lib/member-register";
import { createMemberPreview,commitMembers,memberBatchAction,importUpdate } from "../src/lib/member-import";
import { validateAddresses } from "../src/lib/member-address";
import { type Address } from "../src/domain/member-foundation";
import { memberHeaders } from "../src/domain/member-import";
import { personBody } from "../src/domain/people";
const enabled=!!process.env.DATABASE_URL && /^tpa_(?:member_test_|onboarding_test_member_)/.test(process.env.TPA_DATABASE_NAME??"");
const member=(i:number)=>({prefix:"CA",firstName:"Alice",lastName:`Example ${i}`,email:`member-${i}@example.invalid`,membershipNumber:String(i).padStart(6,"0"),mobile:"+919876543210",organization:"Example & Co",designation:"Partner"});
test("member register transaction safety, previews, repeated imports, updates and optional accounts",{skip:!enabled},async()=>{
  const pool=new Pool(databaseOptions()),c=await pool.connect(),actor=randomUUID();
  try {
    await c.query("BEGIN");
    await c.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Synthetic administrator\',$2,false)',[actor,actor+"@example.invalid"]);
    const saved=await saveMember(c,actor,{member:member(1)});
    const row=(await c.query("SELECT * FROM tpa.people WHERE id=$1",[saved.personId])).rows[0];
    assert.equal(row.user_id,null);assert.equal(row.accepted_verified,false);assert.equal(row.published,null);
    const m=(await c.query("SELECT * FROM tpa.memberships WHERE person_id=$1",[row.id])).rows[0];assert.equal(m.membership_number,"000001");assert.equal(m.status,null);assert.equal(m.type,null);
    await c.query("SAVEPOINT duplicate");await assert.rejects(saveMember(c,actor,{member:{...member(2),email:member(1).email}}));await c.query("ROLLBACK TO SAVEPOINT duplicate");
    await c.query("SAVEPOINT duplicate");await assert.rejects(saveMember(c,actor,{member:{...member(2),membershipNumber:member(1).membershipNumber}}));await c.query("ROLLBACK TO SAVEPOINT duplicate");
    const cells=[memberHeaders,...Array.from({length:250},(_,i)=>["CA","Member",`Person ${i}`,String(i+1000).padStart(6,"0"),`bulk-${i}@example.invalid`,"9876543210","Partner","Example & Co","","","","",""])];
    const preview=await createMemberPreview(c,actor,cells);assert.equal(preview.rows.length,250);assert.ok(preview.rows.every(r=>r.status==="created"));
    let committed; let chunks=0; do {committed=await memberBatchAction(c,actor,{id:preview.id,action:"commit",version:1});chunks++;assert.ok((committed.processed ?? 0)<=chunks*25);} while(committed.complete===false);assert.equal(chunks,10);assert.equal(committed.totals?.created,250);
    const repeat=await memberBatchAction(c,actor,{id:preview.id,action:"commit",version:1});assert.equal(repeat.duplicate,true);
    const repeatedFile=await createMemberPreview(c,actor,cells);assert.ok(repeatedFile.rows.every(r=>r.status==="skipped"));
    const fileRepeat=await commitMembers(c,actor,repeatedFile);assert.ok(fileRepeat.every(r=>r.status==="skipped"));
    cells[1][7]="Updated Firm";const update=await createMemberPreview(c,actor,cells);
    await memberBatchAction(c,actor,{id:update.id,action:"choices",version:1,updateRows:[2],provisionAccounts:false});
    await assert.rejects(memberBatchAction(c,actor,{id:update.id,action:"commit",version:1}),/choices changed/);
    const updated=await memberBatchAction(c,actor,{id:update.id,action:"commit",version:2});assert.equal(updated.totals?.updated,1);
    const stale=await createMemberPreview(c,actor,[memberHeaders,cells[1]]);await c.query("UPDATE tpa.people SET version=version+1 WHERE id=$1",[stale.rows[0].match!.personId]);
    const staleResults=await commitMembers(c,actor,{...stale,choices:{updateRows:[2]}});assert.equal(staleResults[0].status,"conflict");
    const provisioned=await saveMember(c,actor,{member:member(2),provisionAccount:true});assert.ok(provisioned.accountId);assert.equal(provisioned.invitationQueued,false);
    assert.equal((await c.query('SELECT "emailVerified" FROM public."user" WHERE id=$1',[provisioned.accountId])).rows[0].emailVerified,false);
    assert.equal((await c.query("SELECT count(*)::int n FROM tpa.staff_roles WHERE user_id=$1",[provisioned.accountId])).rows[0].n,0);
    const orphan=(await saveMember(c,actor,{member:member(3),provisionAccount:true}));await c.query('DELETE FROM public."user" WHERE id=$1',[orphan.accountId]);
    assert.equal((await c.query("SELECT user_id FROM tpa.people WHERE id=$1",[orphan.personId])).rows[0].user_id,null);assert.equal((await c.query("SELECT count(*)::int n FROM tpa.memberships WHERE person_id=$1",[orphan.personId])).rows[0].n,1);
    // Inject a DB failure after a person write to prove the per-row savepoint removes every partial record.
    await c.query("CREATE FUNCTION tpa.test_membership_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.membership_number='009999' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$");
    await c.query("CREATE TRIGGER test_membership_failure BEFORE INSERT ON tpa.memberships FOR EACH ROW EXECUTE FUNCTION tpa.test_membership_failure()");
    const partial=await createMemberPreview(c,actor,[memberHeaders,["CA","Fail","Person","009999","fail@example.invalid","","","","","","","",""],["CA","Good","Person","009998","good@example.invalid","","","","","","","",""]]);
    const partialResult=await commitMembers(c,actor,{...partial,choices:{provisionAccounts:true}});assert.equal(partialResult[0].status,"failed");assert.equal(partialResult[1].status,"created");
    assert.equal((await c.query("SELECT count(*)::int n FROM tpa.people WHERE contact_email='fail@example.invalid'")).rows[0].n,0);assert.equal((await c.query('SELECT count(*)::int n FROM public."user" WHERE email=\'fail@example.invalid\'')).rows[0].n,0);
    assert.ok(!JSON.stringify((await c.query("SELECT payload FROM tpa.onboarding_mail")).rows).includes("#token="));
  } finally {await c.query("ROLLBACK");c.release();await pool.end();}
});
test("postal hierarchy, city aliases, parent changes, PIN ambiguity and draft completion",{skip:!enabled},async()=>{
  const pool=new Pool(databaseOptions()),c=await pool.connect();
  try {
    await c.query("BEGIN");await c.query("UPDATE tpa.postal_versions SET active=false");await c.query("INSERT INTO tpa.postal_versions(id,source_url,source_sha256,active) VALUES('test-postal','https://example.invalid','test',true)");
    await c.query("INSERT INTO tpa.postal_locations(version_id,pin,state,district,locality) VALUES('test-postal','700001','West Bengal','Kolkata','GPO'),('test-postal','700001','West Bengal','Kolkata','Locality Two'),('test-postal','800001','Bihar','Patna','Patna GPO'),('test-postal','999999','Bihar','Patna','A'),('test-postal','999999','West Bengal','Kolkata','B')");
    await c.query("INSERT INTO tpa.postal_city_aliases VALUES('test-postal','West Bengal','Kolkata','calcutta','Kolkata')");
    const address:Address={line1:"1 Example Road",line2:"",country:"IN",state:"",district:"",city:"Calcutta",postalLocality:"",postalCode:"700001"};
    const good=await validateAddresses(c,{correspondence:address});assert.equal(good.correspondence!.state,"West Bengal");assert.equal(good.correspondence!.district,"Kolkata");assert.equal(good.correspondence!.city,"Kolkata");assert.equal(good.correspondence!.postalLocality,"");
    await assert.rejects(validateAddresses(c,{office:{...address,state:"Bihar"}}));await assert.rejects(validateAddresses(c,{office:{...address,city:"Patna"}}));await assert.rejects(validateAddresses(c,{office:{...address,postalCode:"999999",city:""}}));
    await assert.rejects(validateAddresses(c,{office:{...address,postalCode:"123",city:""}}));
    await assert.doesNotReject(validateAddresses(c,{office:{...address,postalCode:"700",city:"",state:"West Bengal"}},{},true));
    const base={...member(1),addresses:good};const incoming={...base,addresses:{correspondence:{...address,state:"Bihar",district:"",city:"",postalCode:"800001"}}};
    const changed=importUpdate(base,incoming);assert.equal(changed.addresses.correspondence!.district,"");assert.equal(changed.addresses.correspondence!.city,"");const check=await validateAddresses(c,changed.addresses,base.addresses);assert.equal(check.correspondence!.district,"Patna");
    const legacy={...address,postalCode:"bad"};assert.deepEqual(await validateAddresses(c,{office:legacy},{office:legacy}),{office:legacy});
  } finally {await c.query("ROLLBACK");c.release();await pool.end();}
});
test("concurrent creation cannot duplicate a normalized membership number",{skip:!enabled},async()=>{
  const pool=new Pool(databaseOptions()),actor=randomUUID();
  await pool.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Race fixture\',$2,false)',[actor,actor+"@example.invalid"]);
  const a=await pool.connect(),b=await pool.connect();
  const winner={...member(500),email:actor+"-winner@example.invalid"},loser={...member(501),email:actor+"-loser@example.invalid"};
  try {
    await a.query("BEGIN");await b.query("BEGIN");
    const number="Race "+randomUUID();
    await saveMember(a,actor,{member:{...winner,membershipNumber:number}});
    const second=saveMember(b,actor,{member:{...loser,membershipNumber:number.toUpperCase().replace(" ","  ")}});
    const expected=assert.rejects(second,(error:unknown)=>!!error && typeof error==="object" && ((error as {code?:string}).code==="23505" || (error as {status?:number}).status===409));
    await a.query("COMMIT");await expected;await b.query("ROLLBACK");
    assert.equal((await pool.query("SELECT count(*)::int n FROM tpa.memberships WHERE lower(regexp_replace(btrim(membership_number),'[[:space:]]+',' ','g'))=lower($1)",[number])).rows[0].n,1);
    assert.equal((await pool.query("SELECT count(*)::int n FROM tpa.people WHERE contact_email=$1",[loser.email])).rows[0].n,0);
    await pool.query("UPDATE tpa.people SET contact_email=upper(contact_email) WHERE contact_email=$1",[winner.email]);
    assert.ok(await matchMember(pool,{...winner,membershipNumber:number,addresses:{}}));
  } finally {await a.query("ROLLBACK");await b.query("ROLLBACK");a.release();b.release();await pool.end();}
});
test("legacy Student policy and data survive while new Student records are prohibited",{skip:!enabled},async()=>{
  const pool=new Pool(databaseOptions()),c=await pool.connect(),actor=randomUUID();
  try {
    await c.query("BEGIN");await c.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Legacy fixture\',$2,false)',[actor,actor+"@example.invalid"]);
    await c.query("ALTER TABLE tpa.application_drafts DISABLE TRIGGER professional_application_write");
    await c.query("INSERT INTO tpa.application_drafts(id,user_id,plan,category,details) VALUES($1,$2,'Annual','Student','{\"studentEvidence\":\"legacy\"}')",[randomUUID(),actor]);await c.query("ALTER TABLE tpa.application_drafts ENABLE TRIGGER professional_application_write");
    await c.query("UPDATE tpa.application_drafts SET details=details || '{\"fullName\":\"Legacy\"}' WHERE user_id=$1",[actor]);
    await c.query("SAVEPOINT student");await assert.rejects(c.query("INSERT INTO tpa.application_drafts(id,user_id,plan,category,details) VALUES($1,$2,'Annual','Student','{}')",[randomUUID(),actor]),{code:"23514"});await c.query("ROLLBACK TO SAVEPOINT student");
    await c.query("UPDATE tpa.application_drafts SET category='Professional' WHERE user_id=$1",[actor]);assert.equal((await c.query("SELECT details FROM tpa.application_drafts WHERE user_id=$1",[actor])).rows[0].details.studentEvidence,"legacy");
    // Rehearse the migration against a populated legacy schema inside a rollback-only transaction.
    await c.query("DROP TRIGGER professional_application_write ON tpa.application_drafts");await c.query("DROP FUNCTION tpa.professional_application_write()");
    const person=personBody({name:"Legacy account"});assert.equal(person.email,undefined);
    assert.match(await readFile("migrations/023_member_foundation.sql","utf8"),/Publish a successor policy/);
  } finally {await c.query("ROLLBACK");c.release();await pool.end();}
});
test("preservation imports hold differences and forbid updates or accounts",{skip:!enabled},async()=>{
  const pool=new Pool(databaseOptions()),c=await pool.connect(),actor=randomUUID();
  try {
    await c.query("BEGIN");await c.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Preservation fixture\',$2,false)',[actor,actor+"@example.invalid"]);
    const saved=await saveMember(c,actor,{member:member(700)});
    const values=["CA","Alice","Example 700","000700","member-700@example.invalid","9876543210","Partner","Example & Co","","","","",""];
    const exact=await createMemberPreview(c,actor,[memberHeaders,values],undefined,undefined,true);assert.equal(exact.rows[0].status,"skipped");
    values[7]="Different firm";
    const changed=await createMemberPreview(c,actor,[memberHeaders,values],undefined,undefined,true);assert.equal(changed.rows[0].status,"conflict");
    await assert.rejects(memberBatchAction(c,actor,{action:"choices",id:changed.id,version:1,updateRows:[2],provisionAccounts:false}),/Preservation/);
    await assert.rejects(memberBatchAction(c,actor,{action:"choices",id:changed.id,version:1,updateRows:[],provisionAccounts:true}),/Preservation/);
    const result=await memberBatchAction(c,actor,{action:"commit",id:changed.id,version:1});assert.equal(result.totals?.conflict,1);
    const missingDistrict=["CA","New","Person",actor+"-01",actor+"-new@example.invalid","","","","12 Synthetic Road","India","West Bengal","","700001"];
    const held=await createMemberPreview(c,actor,[memberHeaders,missingDistrict],undefined,undefined,true);assert.equal(held.rows[0].status,"conflict");assert.equal(held.rows[0].member!.addresses.correspondence!.district,"");assert.ok(held.rows[0].fieldErrors["addresses.correspondence.district"]);
    const heldResult=await memberBatchAction(c,actor,{action:"commit",id:held.id,version:1});assert.equal(heldResult.totals?.created,0);assert.equal(heldResult.totals?.conflict,1);
    assert.equal((await c.query("SELECT accepted->>'organization' organization,user_id,version FROM tpa.people WHERE id=$1",[saved.personId])).rows[0].organization,"Example & Co");
    assert.equal((await c.query('SELECT count(*)::int n FROM tpa.onboarding_invitations i JOIN public."user" u ON u.id=i.user_id WHERE u.email=$1',[member(700).email])).rows[0].n,0);
  } finally {await c.query("ROLLBACK");c.release();await pool.end();}
});
test("invitation hold failure rolls back account, person and membership with savepoint recovery",{skip:!enabled},async()=>{
  const pool=new Pool(databaseOptions()),c=await pool.connect(),actor=randomUUID(),failEmail="queue-failure@example.invalid";
  try {
    await c.query("BEGIN");await c.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Queue fixture\',$2,false)',[actor,actor+"@example.invalid"]);
    await c.query("CREATE FUNCTION tpa.test_invitation_queue_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM public.\"user\" WHERE id=NEW.user_id AND email='queue-failure@example.invalid') THEN RAISE EXCEPTION 'synthetic hold failure'; END IF; RETURN NEW; END $$");
    await c.query("CREATE TRIGGER test_invitation_queue_failure BEFORE INSERT ON tpa.account_invitation_holds FOR EACH ROW EXECUTE FUNCTION tpa.test_invitation_queue_failure()");
    const preview=await createMemberPreview(c,actor,[memberHeaders,["CA","Queue","Fail","999997",failEmail,"","","","","","","",""],["CA","Queue","Good","999996","queue-good@example.invalid","","","","","","","",""]]);
    const results=await commitMembers(c,actor,{...preview,choices:{provisionAccounts:true}});assert.equal(results[0].status,"failed");assert.equal(results[1].status,"created");assert.equal("invitationQueued" in results[1] && results[1].invitationQueued,false);
    assert.equal((await c.query('SELECT count(*)::int n FROM public."user" WHERE email=$1',[failEmail])).rows[0].n,0);
    assert.equal((await c.query("SELECT count(*)::int n FROM tpa.people WHERE contact_email=$1",[failEmail])).rows[0].n,0);
    assert.equal((await c.query("SELECT count(*)::int n FROM tpa.memberships WHERE membership_number='999997'")).rows[0].n,0);
    assert.equal((await c.query("SELECT count(*)::int n FROM tpa.onboarding_mail WHERE recipient=$1",[failEmail])).rows[0].n,0);
  } finally {await c.query("ROLLBACK");c.release();await pool.end();}
});

