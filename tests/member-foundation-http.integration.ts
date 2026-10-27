import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID,randomBytes,createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import { memberHeaders } from "../src/domain/member-import";
const base=process.env.TPA_TEST_URL,enabled=!!base && /^tpa_(?:member_test_|onboarding_test_member_)/.test(process.env.TPA_DATABASE_NAME??"");
test("member HTTP contracts enforce access, errors, register retrieval, previews and password boundaries",{skip:!enabled},async()=>{
  const pool=new Pool(databaseOptions()),actors=[randomUUID(),randomUUID(),randomUUID()],cookies:string[]=[],prefix=randomUUID().slice(0,8);
  const request=(path:string,actor?:number,data?:unknown,headers:Record<string,string>={})=>fetch(base+path,{redirect:"manual",method:data===undefined?"GET":"POST",headers:{...(actor===undefined?{}:{Cookie:cookies[actor]}),...(data===undefined?{}:{"Content-Type":"application/json",Origin:base!}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
  try {
    for(const [i,id] of actors.entries()) {
      await pool.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'HTTP synthetic\',$2,true)',[id,id+"@example.invalid"]);
      const token=randomBytes(32).toString("hex");await pool.query('INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',[randomUUID(),token,id]);
      cookies[i]="better-auth.session_token="+encodeURIComponent(token+"."+createHmac("sha256",process.env.BETTER_AUTH_SECRET!).update(token).digest("base64"));
    }
    await pool.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator'),($2,'membership_reviewer')",[actors[0],actors[2]]);
    assert.equal((await request("/api/staff/members?view=register")).status,401);
    const member={prefix:"CA",firstName:"Alice",lastName:"Synthetic",email:prefix+"@example.invalid",membershipNumber:prefix+"-001",mobile:"9876543210"};
    assert.equal((await request("/api/staff/members",1,{action:"create",member})).status,403);
    assert.equal((await request("/api/staff/members",2,{action:"create",member})).status,403);
    assert.equal((await request("/api/staff/members",0,{action:"create",member},{Origin:"https://example.invalid"})).status,403);
    const invalid=await request("/api/staff/members",0,{action:"create",member:{...member,email:"bad",lastName:""}});assert.equal(invalid.status,400);assert.ok((await invalid.json()).fieldErrors.email);
    const created=await request("/api/staff/members",0,{action:"create",member});assert.equal(created.status,200);const id=(await created.json()).result.personId;
    const directory=await request("/api/staff/members?view=register&id="+id,2);assert.equal(directory.status,200);const row=(await directory.json()).rows[0];assert.equal(row.user_id,null);assert.equal(row.membership_number,member.membershipNumber);assert.equal(row.professional_verified,false);assert.equal(row.status,null);
    assert.equal(row.person.name,"CA Alice Synthetic");
    assert.equal((await request("/api/staff/members",0,{action:"create",member})).status,409);
    assert.equal((await request("/api/auth/sign-up/email",undefined,{name:"Existing registered member",email:member.email,password:"Eight888"})).status,409);
    assert.equal((await request("/api/staff/members",0,{action:"update",personId:id,personVersion:0,membershipVersion:1,member})).status,409);
    assert.equal((await request("/api/staff/members",0,{action:"update",personId:id,personVersion:1,membershipVersion:1,member:{...member,organization:"Updated"}})).status,200);
    const legacyAddresses={correspondence:{line1:" Legacy  Road ",line2:"",country:"IN",state:"Old State",district:"Old District",city:"Old City",postalLocality:"Old Locality",postalCode:"bad"}};
    await pool.query("UPDATE tpa.people SET accepted=jsonb_set(jsonb_set(accepted,'{mobile}','\"1234567890\"'),'{addresses}',$2::jsonb),draft=jsonb_set(jsonb_set(draft,'{mobile}','\"1234567890\"'),'{addresses}',$2::jsonb),mobile_normalized=NULL WHERE id=$1",[id,JSON.stringify(legacyAddresses)]);
    assert.equal((await request("/api/staff/members",0,{action:"update",personId:id,personVersion:2,membershipVersion:2,member:{...member,mobile:"1234567890",organization:"Preserved legacy",addresses:legacyAddresses}})).status,200);
    assert.equal((await pool.query("SELECT mobile_normalized FROM tpa.people WHERE id=$1",[id])).rows[0].mobile_normalized,null);
    assert.equal((await request("/api/staff/members",0,{action:"update",personId:id,personVersion:3,membershipVersion:3,member:{...member,mobile:"new invalid mobile"}})).status,400);
    assert.equal((await request("/api/staff/members",0,{action:"update",personId:id,personVersion:3,membershipVersion:3,member:{...member,mobile:"1234567890"},membership:{validFrom:"2026-99-99"}})).status,400);
    const legacyPerson=(await pool.query("SELECT accepted FROM tpa.people WHERE id=$1",[id])).rows[0].accepted;assert.deepEqual(legacyPerson.addresses,legacyAddresses);
    assert.equal((await request("/api/staff/governance",0,{action:"save",id,version:3,body:{...legacyPerson,biography:"Legacy preservation check"}})).status,200);
    const retained=(await pool.query("SELECT draft FROM tpa.people WHERE id=$1",[id])).rows[0].draft;assert.equal(retained.mobile,"1234567890");assert.deepEqual(retained.addresses,legacyAddresses);
    assert.equal((await request("/api/staff/governance",0,{action:"save",id,version:4,body:{...retained,mobile:"changed invalid mobile"}})).status,400);
    const optMember={...member,email:prefix+"-opt@example.invalid",membershipNumber:prefix+"-opt"};
    const optResponse=await request("/api/staff/members",0,{action:"create",member:optMember,provisionAccount:true});assert.equal(optResponse.status,200);const opt=(await optResponse.json()).result;assert.ok(opt.accountId);assert.equal(opt.invitationQueued,false);
    assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.account_invitation_holds WHERE user_id=$1 AND released_at IS NULL',[opt.accountId])).rows[0].n,1);
    assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.onboarding_mail WHERE user_id=$1',[opt.accountId])).rows[0].n,0);
    assert.ok(opt.warnings.some((warning:string)=>warning.includes("Shared numbers")));
    assert.equal((await pool.query('SELECT "emailVerified" FROM public."user" WHERE id=$1',[opt.accountId])).rows[0].emailVerified,false);assert.equal((await pool.query("SELECT count(*)::int n FROM tpa.staff_roles WHERE user_id=$1",[opt.accountId])).rows[0].n,0);
    const optRepeat=await request("/api/staff/members",0,{action:"update",member:optMember,personId:opt.personId,personVersion:1,membershipVersion:1,provisionAccount:true});assert.equal(optRepeat.status,200);assert.equal((await optRepeat.json()).result.invitationQueued,false);assert.equal((await pool.query("SELECT count(*)::int n FROM tpa.onboarding_invitations WHERE user_id=$1",[opt.accountId])).rows[0].n,0);
    const form=new FormData();form.set("mode","existing-members");form.set("file",new File([memberHeaders.join(",")+"\n"+["CA","Bulk","Synthetic",prefix+"-002",prefix+"-bulk@example.invalid","","","","","","","",""].join(",")+"\n"+["CA","Invalid","Synthetic",prefix+"-003","bad","","","","","","","",""].join(",")],"members.csv",{type:"text/csv"}));
    const previewResponse=await fetch(base+"/api/staff/onboarding-import",{method:"POST",headers:{Cookie:cookies[0],Origin:base!},body:form});assert.equal(previewResponse.status,200);const preview=await previewResponse.json();assert.equal(preview.rows.length,2);assert.equal(preview.rows[1].sourceRow,3);assert.equal(preview.rows[1].status,"failed");
    assert.equal((await request("/api/staff/onboarding-import",2,{action:"commit",id:preview.id,version:1})).status,403);
    const oldPreview=randomUUID();await pool.query("INSERT INTO tpa.onboarding_batches(id,actor_id,rows,mode,choices) VALUES($1,$2,'[]','members','{}')",[oldPreview,actors[0]]);
    const stalePolicy=await request("/api/staff/onboarding-import",0,{action:"commit",id:oldPreview,version:1});assert.equal(stalePolicy.status,409);assert.equal((await stalePolicy.json()).code,"stale_batch_policy");
    assert.equal((await request("/api/staff/onboarding-import",0,{action:"choices",id:preview.id,version:1,updateRows:[],provisionAccounts:true})).status,400);
    const commit=await request("/api/staff/onboarding-import",0,{action:"commit",id:preview.id,version:1});assert.equal(commit.status,200);assert.deepEqual((await commit.json()).totals,{created:1,updated:0,skipped:0,conflict:0,failed:1});
    assert.equal((await (await request("/api/staff/onboarding-import",0,{action:"commit",id:preview.id,version:1})).json()).duplicate,true);
    const postalCsv=memberHeaders.join(",")+"\n"+["CA","Postal","Synthetic",prefix+"-postal",prefix+"-postal@example.invalid","","","","12 Synthetic Road","India","West Bengal","Kolkata","700001"].join(",");
    for(const mode of ["members","existing-members"]) {
      const postalForm=new FormData();postalForm.set("mode",mode);postalForm.set("file",new File([postalCsv],"postal.csv",{type:"text/csv"}));
      const response=await fetch(base+"/api/staff/onboarding-import",{method:"POST",headers:{Cookie:cookies[0],Origin:base!},body:postalForm});assert.equal(response.status,200);const data=await response.json();
      assert.equal(data.rows[0].status,mode==="members"?"created":"conflict");assert.equal(data.rows[0].member.addresses.correspondence.district,mode==="members"?"Kolkata":"");
      if(mode==="existing-members") {const result=await (await request("/api/staff/onboarding-import",0,{action:"commit",id:data.id,version:1})).json();assert.equal(result.totals.created,0);assert.equal(result.totals.conflict,1);}
    }
    assert.equal((await request("/api/member/locations?pin=700001")).status,401);const lookup=await request("/api/member/locations?pin=700001",1);assert.equal(lookup.status,200);const postal=await lookup.json();assert.ok(postal.localities.length>1);assert.equal(postal.exactLocation,false);assert.ok(postal.states.length>=30);
    assert.equal((await request("/api/member/application",1,{category:"Student",plan:"Annual",version:0,details:{},documentIds:[]})).status,400);
    await pool.query("INSERT INTO tpa.application_drafts(id,user_id,plan,category,details) VALUES($1,$2,'Annual','Professional','{\"phone\":\"1234567890\"}')",[randomUUID(),actors[1]]);
    const legacyDraft=await request("/api/member/application",1,{category:"Professional",plan:"Annual",version:1,details:{phone:"1234567890",fullName:" Legacy   Draft ",organization:"Example  & Co"},documentIds:[]});assert.equal(legacyDraft.status,200);const savedDraft=await legacyDraft.json();assert.equal(savedDraft.details.phone,"1234567890");assert.equal(savedDraft.details.fullName,"Legacy Draft");
    const ordinary="boundary-"+prefix+"@example.invalid";
    const signup=(password:string)=>request("/api/auth/sign-up/email",undefined,{name:"Boundary synthetic",email:ordinary+password.length,password});
    assert.equal((await signup("a".repeat(5))).status,400);assert.equal((await signup("a".repeat(13))).status,400);assert.equal((await signup("a".repeat(6))).status,200);assert.equal((await signup("a".repeat(12))).status,200);
    assert.equal((await request("/api/onboarding/invitation",undefined,{token:"x".repeat(43),password:"a".repeat(5)})).status,400);
    assert.equal((await request("/api/onboarding/invitation",undefined,{token:"x".repeat(43),password:"a".repeat(13)})).status,400);
  } finally {await pool.end();}
});
