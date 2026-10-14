import assert from 'node:assert/strict';import {Pool} from 'pg';import {randomUUID,randomBytes,createHmac} from 'node:crypto';import {spawn} from 'node:child_process';import {databaseOptions} from '../src/lib/database-options';import {invitationDefaults} from '../src/domain/invitation-template';
assert.ok(process.env.TPA_DATABASE_NAME?.startsWith('tpa_onboarding_test_invitations_'));
const pool=new Pool(databaseOptions()),base=process.env.TPA_TEST_URL!,cookies:string[]=[],server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3142'],{env:process.env,stdio:'inherit'});
const post=(path:string,data:unknown,index=0,origin=base)=>fetch(base+path,{method:'POST',headers:{Cookie:cookies[index]??'',Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
try{let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,1000));}assert.ok(ready);
 for(const role of ['administrator','communications_operator','membership_reviewer','ordinary']){const id=randomUUID(),token=randomBytes(24).toString('hex');await pool.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Synthetic API actor\',$2,true)',[id,id+'@example.invalid']);if(role!=='ordinary')await pool.query('INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,$2)',[id,role]);await pool.query('INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',[randomUUID(),token,id]);cookies.push('better-auth.session_token='+encodeURIComponent(token+'.'+createHmac('sha256',process.env.BETTER_AUTH_SECRET!).update(token).digest('base64')));}
 const path='/api/staff/invitation-templates',release='/api/staff/invitation-releases';assert.equal((await fetch(base+path)).status,401);
 for(const index of [1,2,3])assert.equal((await post(path,{action:'save',revision:0,...invitationDefaults},index)).status,403);
 assert.equal((await post(path,{action:'save',revision:0,...invitationDefaults},0,'https://example.invalid')).status,403);
 assert.equal((await post(path,{action:'preview',subject:'bad',body:'{{password}}'})).status,400);
 const saved=await post(path,{action:'save',revision:0,...invitationDefaults});assert.equal(saved.status,200);const draft=await saved.json();
 assert.equal((await post(path,{action:'approve',id:draft.latest_id,revision:0})).status,409);
 assert.equal((await post(path,{action:'approve',id:draft.latest_id,revision:draft.revision})).status,200);
 const person=randomUUID(),user=randomUUID(),email=user+'@example.invalid';await pool.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Synthetic recipient\',$2,false)',[user,email]);await pool.query("INSERT INTO tpa.people(id,user_id,accepted,draft,contact_email) VALUES($1,$2,'{\"name\":\"Synthetic recipient\"}','{\"name\":\"Synthetic recipient\"}',$3)",[person,user,email]);await pool.query("INSERT INTO tpa.memberships(id,person_id,membership_number,source) VALUES($1,$2,$3,'staff')",[randomUUID(),person,user]);await pool.query('INSERT INTO tpa.account_invitation_holds(user_id) VALUES($1)',[user]);
 for(const action of ['invite','resend','release'])assert.equal((await post('/api/staff/member-actions',{action,personId:person})).status,409);
 assert.equal((await post(release,{action:'review',personIds:['invalid']})).status,400);
 const reviewResponse=await post(release,{action:'review',personIds:[person,randomUUID()]});assert.equal(reviewResponse.status,200);const review=await reviewResponse.json();assert.equal(review.recipients.length,1);assert.equal(review.exclusions.length,1);
 assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.onboarding_mail WHERE user_id=$1',[user])).rows[0].n,0);
 assert.equal((await fetch(base+release+'?id='+review.id,{headers:{Cookie:cookies[1]}})).status,403);
 assert.equal((await post(release,{action:'confirm',id:review.id,idempotencyKey:randomUUID()})).status,409);
 for(let i=0;i<2;i++)assert.equal((await post(release,{action:'confirm',id:review.id,idempotencyKey:review.idempotency_key})).status,200);
 assert.equal((await pool.query('SELECT count(*)::int n FROM tpa.onboarding_mail WHERE user_id=$1',[user])).rows[0].n,1);
 assert.equal((await pool.query('SELECT count(*)::int n FROM public."account" WHERE "userId"=$1',[user])).rows[0].n,0);
 const status=await (await fetch(base+release+'?id='+review.id,{headers:{Cookie:cookies[0]}})).json();assert.equal(status.delivery[0].status,'queued');
 console.log(JSON.stringify({http:'passed',reviewed:1,excluded:1,queued:1,replayAdditionalMail:0,realEmailsSent:0}));
 const regression=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','--test','tests/onboarding-http.integration.ts','tests/workspace-ux-http.integration.ts'],{env:process.env,stdio:'inherit'});child.on('error',reject);child.on('exit',resolve);});assert.equal(regression,0,'Onboarding HTTP regression failed');
}finally{if(server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}await pool.end();}
