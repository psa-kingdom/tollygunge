import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdir,readFile,readdir,writeFile,access} from 'node:fs/promises';
import {Pool} from 'pg';
import {chromium,expect} from '@playwright/test';
import {Webhook} from 'svix';
import {hashPassword} from 'better-auth/crypto';
import {databaseOptions} from '../src/lib/database-options';
import {memberHeaders} from '../src/domain/member-import';
import {memberDisplayName} from '../src/domain/member-foundation';
import {runOnboardingTick} from '../src/lib/onboarding-delivery';
import {providerRequest} from '../src/lib/email-provider';
import {mailPreflight} from './operational-mail-preflight.mts';

// Explicit opt-in; the only external recipients are the saved approved test inboxes.
assert.ok(process.argv.includes('--send-approved-tests'),'Pass --send-approved-tests to enable real test delivery.');
const runId=new Date().toISOString().replaceAll(':','-'),dir='.local/operational-delivery/'+runId;
const reusePath=process.argv.find(a=>a.startsWith('--reuse-import='))?.slice('--reuse-import='.length);
const reuseAccountPath=process.argv.find(a=>a.startsWith('--reuse-account='))?.slice('--reuse-account='.length);
const name='tpa_onboarding_test_delivery_'+randomUUID().replaceAll('-',''),base='http://127.0.0.1:3139';
const root=new Pool(databaseOptions()),url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;
const readiness=await mailPreflight(),approved=readiness.output.recipients,recipient=approved[0];
const quota=readiness.output.quota;
for(const window of [quota.daily,quota.monthly]) assert.ok(window.limit===null || window.limit-window.used>=30,'Insufficient test-mail quota headroom.');
const env={...process.env,...readiness.env,DATABASE_URL:url.href,TPA_DATABASE_NAME:name,BETTER_AUTH_URL:base,
  BETTER_AUTH_SECRET:randomBytes(32).toString('hex'),RESEND_WEBHOOK_SECRET:'whsec_'+randomBytes(32).toString('base64'),
  ONBOARDING_ENABLED:'true',EMAIL_OPERATIONS_ENABLED:'true',MEMBER_IMPORT_WORKER_ENABLED:'true',TPA_MAIL_SINK:'false',
  SMTP_HOST:'',SMTP_USER:'',SMTP_PASSWORD:'',R2_ACCESS_KEY_ID:'',R2_SECRET_ACCESS_KEY:'',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:''};
const db=new Pool(databaseOptions(env)),children:ChildProcess[]=[],check=expect.configure({timeout:45000});
type MailEvidence={label:string;jobId?:string;providerId:string;subject?:string;queued?:boolean;providerAccepted:boolean;providerDelivered:boolean;signedHostedEvents:string[];stagingReplayVerified?:boolean;mailboxReceived:boolean;transport?:string;sourceEvidence?:string};
const evidence:Record<string,unknown>&{scenarios:Record<string,unknown>;emails:MailEvidence[]}={runId,buildId:(await readFile('.next/BUILD_ID','utf8')).trim(),syntheticOnly:true,
  approvedRecipient:recipient,readiness:readiness.output,scenarios:{},emails:[],mailboxReceipt:'awaiting-recipient-confirmation',passed:false};
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,created=false;
let mailWorker:ChildProcess|undefined;
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function save(){await writeFile(dir+'/acceptance.json',JSON.stringify(evidence,null,2));}
function child(args:string[]){const p=spawn(process.execPath,args,{env,stdio:'ignore'});children.push(p);return p;}
async function cookie(id:string){const t=randomBytes(32).toString('hex');await db.query('INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',[randomUUID(),t,id]);return encodeURIComponent(t+'.'+createHmac('sha256',env.BETTER_AUTH_SECRET).update(t).digest('base64'));}
let adminCookie='';
async function request(path:string,body?:unknown,c=adminCookie,status=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:'better-auth.session_token='+c,Origin:base,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,'Unexpected response for '+path+': '+JSON.stringify(data));return data;}
async function until<T>(label:string,fn:()=>Promise<T|undefined>,timeout=240000):Promise<T>{const end=Date.now()+timeout;while(Date.now()<end){const result=await fn();if(result!==undefined)return result;await wait(2000);}throw Error('Timed out: '+label);}
async function queueSnapshot(){return (await db.query('SELECT id,recipient,kind,payload FROM tpa.onboarding_mail WHERE status=\'queued\' AND recipient=$1 ORDER BY created_at',[recipient])).rows;}
async function startMailWorker(){
  // Every unapproved recipient is locally suppressed before this process exists.
  await db.query("INSERT INTO tpa.email_suppressions(email,reason) SELECT DISTINCT recipient,'suppressed' FROM tpa.onboarding_mail WHERE NOT(recipient=ANY($1::text[])) ON CONFLICT DO NOTHING",[approved]);
  mailWorker=child(['.next/email-worker.mjs']);return mailWorker;
}
async function delivered(jobId:string,label:string){
  const job=await until(label+' provider acceptance',async()=>{const r=(await db.query('SELECT provider_id,status,reason FROM tpa.onboarding_mail WHERE id=$1',[jobId])).rows[0];if(r.status==='failed'||r.status==='bounced')throw Error(label+' delivery failed: '+r.reason);return r.provider_id?r:undefined;});
  const item:MailEvidence={label,jobId,providerId:job.provider_id,queued:true,providerAccepted:true,providerDelivered:false,signedHostedEvents:[],stagingReplayVerified:false,mailboxReceived:false};
  evidence.emails.push(item);await save();
  const remote=await until(label+' actual provider delivery',async()=>{const r=await providerRequest('/emails/'+job.provider_id,readiness.env.RESEND_RECEIVING_API_KEY!);if(['bounced','failed','complained'].includes(r.last_event))throw Error(label+' provider failure');return r.last_event==='delivered'?r:undefined;});
  assert.deepEqual(remote.to,[recipient]);assert.ok(remote.from.includes('no-reply@updates.tpassociation.org'));
  item.providerDelivered=true;item.subject=remote.subject;
  // Actual provider events arrive at the existing signature-verifying hosted endpoint.
  // Observe only our message IDs, then replay normalized events into isolated staging.
  const events=await until(label+' signed hosted event',async()=>{const rows=(await root.query('SELECT event_id,type,occurred_at FROM tpa.email_events WHERE provider_id=$1',[job.provider_id])).rows;return rows.some(r=>r.type==='email.delivered')?rows:undefined;});
  item.signedHostedEvents=events.map(r=>r.type);
  for(const event of events){const id='stage_'+randomUUID(),timestamp=new Date(),payload=JSON.stringify({type:event.type,created_at:event.occurred_at,data:{email_id:job.provider_id,from:remote.from,to:remote.to}}),signature=new Webhook(env.RESEND_WEBHOOK_SECRET).sign(id,timestamp,payload);
    const r=await fetch(base+'/api/webhooks/resend',{method:'POST',headers:{'Content-Type':'application/json','svix-id':id,'svix-timestamp':String(Math.floor(timestamp.getTime()/1000)),'svix-signature':signature},body:payload});assert.equal(r.status,200);
    const repeat=await fetch(base+'/api/webhooks/resend',{method:'POST',headers:{'Content-Type':'application/json','svix-id':id,'svix-timestamp':String(Math.floor(timestamp.getTime()/1000)),'svix-signature':signature},body:payload});assert.equal(repeat.status,200);
  }
  assert.equal((await db.query('SELECT status FROM tpa.onboarding_mail WHERE id=$1',[jobId])).rows[0].status,'delivered');
  item.stagingReplayVerified=true;await save();console.log('Delivered: '+label+'; signed provider event observed.');return remote;
}
async function deliverNewest(label:string){const ids=evidence.emails.flatMap(m=>m.jobId?[m.jobId]:[]);const rows=(await db.query("SELECT id FROM tpa.onboarding_mail WHERE recipient=$1 AND NOT(id=ANY($2::uuid[])) ORDER BY created_at",[recipient,ids])).rows;assert.equal(rows.length,1,label+' should create exactly one notification regardless of worker timing');return delivered(rows[0].id,label);}

try{
  await mkdir(dir,{recursive:true});await save();
  await access('.next/member-import-worker.mjs');await access('.next/email-worker.mjs');
  await root.query('CREATE DATABASE '+name);created=true;
  const files=(await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort();
  await db.query('BEGIN;\n'+(await Promise.all(files.map(f=>readFile('migrations/'+f,'utf8')))).join('\n')+'\nCOMMIT;');
  await db.query('UPDATE tpa.onboarding_settings SET test_recipients=$1 WHERE id=true',[JSON.stringify(approved)]);
  const server=child(['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3139']);
  await until('staging web',async()=>{if(server.exitCode!==null)throw Error('Staging server stopped');try{if((await fetch(base+'/api/health')).ok)return true;}catch{}return undefined;},60000);
  const admin=randomUUID();await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Staging operations administrator\',\'admin@example.invalid\',true)',[admin]);
  await db.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",[admin]);adminCookie=await cookie(admin);
  browser=await chromium.launch({headless:true,channel:process.env.TPA_BROWSER_CHANNEL??'chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Kolkata'});await context.addCookies([{name:'better-auth.session_token',value:adminCookie,url:base}]);
  const page=await context.newPage();page.on('dialog',d=>d.accept());
  const browserErrors:string[]=[];page.on('pageerror',()=>browserErrors.push('Browser runtime error'));
  const rows=[memberHeaders,...Array.from({length:200},(_,i)=>['Mr.','Staging','Member'+String(i).padStart(3,'0'),'STAGE-'+String(i).padStart(3,'0'),i===0?recipient:`staging${i}@example.invalid`,'9876543210','','','','','','',''])];
  if(reusePath){
    assert.ok(reusePath.startsWith('.local/operational-delivery/') && reusePath.endsWith('/acceptance.json'),'Use a completed isolated import evidence file.');
    const prior=JSON.parse(await readFile(reusePath,'utf8'));
    assert.equal(prior.buildId,evidence.buildId);assert.equal(prior.approvedRecipient,recipient);assert.equal(prior.scenarios?.A?.passed,true);assert.equal(prior.scenarios.A.imported,200);assert.equal(prior.importRetry?.passed,true);assert.equal(prior.importCorrection?.passed,true);assert.equal(prior.disposableDatabaseRemoved,true);
    // Restore only deterministic synthetic member fixtures. The original 200-row browser/worker
    // phase remains evidenced in its own run, including its later harness-selector failure.
    const restored=rows.slice(1).map(r=>{const input={prefix:r[0],firstName:r[1],lastName:r[2]};return {id:randomUUID(),number:r[3],email:r[4],accepted:{...input,name:memberDisplayName(input),email:r[4],addresses:{}}};});
    await db.query(`WITH source AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,number text,email text,accepted jsonb)),people AS (INSERT INTO tpa.people(id,accepted,draft,contact_email) SELECT id,accepted,accepted,email FROM source RETURNING id) INSERT INTO tpa.memberships(id,person_id,membership_number,source) SELECT gen_random_uuid(),source.id,source.number,'staff' FROM source JOIN people ON people.id=source.id`,[JSON.stringify(restored)]);
    evidence.scenarios.A={...prior.scenarios.A,sourceEvidence:reusePath};evidence.importRetry=prior.importRetry;evidence.importCorrection=prior.importCorrection;evidence.restoredSyntheticMembers=200;
    await save();console.log('Reused completed 200-member browser/worker import evidence; restored only its synthetic member fixtures.');
  }else{
  await page.goto(base+'/admin/workspaces/onboarding');await page.getByLabel('Import mode').selectOption('existing-members');
  await page.getByLabel('CSV/XLSX (5 MB, 1,000 users)').setInputFiles({name:'staging-200.csv',mimeType:'text/csv',buffer:Buffer.from(rows.map(r=>r.join(',')).join('\n'))});
  await page.getByRole('button',{name:'Validate member workbook',exact:true}).click();await check(page.getByRole('button',{name:'Start reviewed member import'})).toBeVisible({timeout:180000});
  const batchId=new URL(page.url()).searchParams.get('id');assert.ok(batchId);
  child(['.next/member-import-worker.mjs']);await page.getByRole('button',{name:'Start reviewed member import'}).click();
  await check(page.getByRole('status').filter({hasText:'records processed'})).toBeVisible();await page.reload();
  const progress:number[]=[];
  const completed=await until('200-member independent worker',async()=>{const j=(await request('/api/staff/member-import-jobs?batchId='+batchId)).job;if(j && progress.at(-1)!==j.processed){progress.push(j.processed);console.log('Import: '+j.processed+'/'+j.total);}return j?.state==='completed'?j:undefined;},900000);
  assert.equal(completed.totals.created,200);await check(page.getByText(/Created: 200 · Skipped: 0/)).toBeVisible();
  assert.equal((await db.query('SELECT count(*)::int n FROM tpa.onboarding_mail')).rows[0].n,0);
  const replay=await request('/api/staff/member-import-jobs',{action:'enqueue',batchId,version:1},adminCookie,202);assert.equal(replay.id,completed.id);
  await page.screenshot({path:dir+'/import-200.png',fullPage:true});
  evidence.scenarios.A={passed:true,imported:200,workerBacked:true,browserUpload:true,reloadResumed:true,progress};await save();
  console.log('A passed: 200 members imported through browser and independent worker.');

  // Exercise an actual invalid source and lineage-preserving correction, rather than retrying bad data blindly.
  const bad=[memberHeaders,['Mr.','Correction','Member','STAGE-CORRECTION','bad-email','9876543210','','','','','','','']];
  async function upload(cells:string[][],parent?:string){const form=new FormData();form.set('file',new File([cells.map(r=>r.join(',')).join('\n')],'correction.csv'));if(parent)form.set('parentBatchId',parent);const r=await fetch(base+'/api/staff/member-import-jobs',{method:'POST',headers:{Cookie:'better-auth.session_token='+adminCookie,Origin:base},body:form});assert.equal(r.status,200);return r.json();}
  const badPreview=await upload(bad),badJob=await request('/api/staff/member-import-jobs',{action:'enqueue',batchId:badPreview.id,version:1},adminCookie,202);
  await until('invalid import result',async()=>{const j=await request('/api/staff/member-import-jobs?id='+badJob.id);return j.state==='completed-with-issues'?j:undefined;});
  await db.query("UPDATE tpa.member_import_job_rows SET status='failed',result=$2 WHERE job_id=$1",[badJob.id,{retryable:true,reason:'Controlled transient failure fixture'}]);
  await page.goto(base+'/admin/workspaces/onboarding?id='+badPreview.id);
  await check(page.getByRole('button',{name:'Retry temporary failures'})).toBeVisible();
  await page.getByRole('button',{name:'Retry temporary failures'}).click();
  await until('safe retry revalidation',async()=>{const j=await request('/api/staff/member-import-jobs?id='+badJob.id);return j.state==='completed-with-issues'&&j.rows[0].status==='invalid'?j:undefined;});
  evidence.importRetry={passed:true,browserRetry:true,controlledTransientFixture:true,invalidSourceStillHeld:true};
  const correction=await request('/api/staff/member-import-jobs?correctionBatchId='+badPreview.id);correction.rows[0][correction.headers.indexOf('Email')]='corrected@example.invalid';
  const fixed=await upload([correction.headers,...correction.rows],badPreview.id),fixedJob=await request('/api/staff/member-import-jobs',{action:'enqueue',batchId:fixed.id,version:1},adminCookie,202);
  await until('corrected import',async()=>{const j=await request('/api/staff/member-import-jobs?id='+fixedJob.id);return j.state==='completed'?j:undefined;});
  assert.equal((await db.query("SELECT count(*)::int n FROM tpa.memberships WHERE membership_number='STAGE-CORRECTION'")).rows[0].n,1);
  evidence.importCorrection={passed:true,originalRowPreserved:true,duplicates:0};await save();
  }

  let member:{person_id:string;user_id:string},mc='';
  const memberContext=await browser.newContext({timezoneId:'Asia/Kolkata'}),mp=await memberContext.newPage();
  if(reuseAccountPath){
    assert.ok(reuseAccountPath.startsWith('.local/operational-delivery/') && reuseAccountPath.endsWith('/acceptance.json'));
    const prior=JSON.parse(await readFile(reuseAccountPath,'utf8'));
    assert.equal(prior.buildId,evidence.buildId);assert.equal(prior.approvedRecipient,recipient);assert.equal(prior.scenarios?.B?.passed,true);assert.equal(prior.scenarios?.C?.passed,true);assert.equal(prior.recovery?.passed,true);assert.equal(prior.disposableDatabaseRemoved,true);assert.equal(prior.hostedTestEventCleanup,true);
    const userId=randomUUID(),person=(await db.query('SELECT id,accepted FROM tpa.people WHERE contact_email=$1',[recipient])).rows[0];
    await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',[userId,person.accepted.name,recipient]);
    const restoredPassword='Synthetic-Staging-Recovered-2026!';
    await db.query('INSERT INTO public."account"(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,\'credential\',$2,$3,now(),now())',[randomUUID(),userId,await hashPassword(restoredPassword)]);
    await db.query('UPDATE tpa.people SET user_id=$2 WHERE id=$1',[person.id,userId]);member={person_id:person.id,user_id:userId};
    const login=await mp.request.post(base+'/api/auth/sign-in/email',{headers:{Origin:base},data:{email:recipient,password:restoredPassword}});assert.equal(login.status(),200);
    mc=(await memberContext.cookies()).find(c=>c.name==='better-auth.session_token')!.value;
    evidence.scenarios.B={...prior.scenarios.B,sourceEvidence:reuseAccountPath};evidence.scenarios.C={...prior.scenarios.C,sourceEvidence:reuseAccountPath};evidence.recovery={...prior.recovery,sourceEvidence:reuseAccountPath};
    const verified=prior.emails.filter((m:MailEvidence)=>['invitation','recovery'].includes(m.label)) as MailEvidence[];assert.equal(verified.length,2);for(const m of verified){assert.equal(m.providerDelivered,true);assert.ok(m.signedHostedEvents.includes('email.delivered'));evidence.emails.push({...m,sourceEvidence:reuseAccountPath});}
    evidence.restoredActivatedAccount=true;await startMailWorker();await save();console.log('Reused verified invitation/activation/recovery evidence; restored synthetic account and signed in without resending mail.');
  }else{
  await page.goto(base+'/admin/workspaces/members');await page.getByLabel('Search members').fill('Staging');await page.getByRole('button',{name:'Search register'}).click();
  const register=await request('/api/staff/members?view=register&q=Staging');
  for(let i=0;i<10;i++){const number='STAGE-'+String(i).padStart(3,'0'),m=register.rows.find((r:{membership_number:string})=>r.membership_number===number);assert.ok(m,'Selected member must exist');await page.getByRole('checkbox',{name:'Select '+m.person.name,exact:true}).check();}
  await page.getByRole('button',{name:'Invite 10 selected members',exact:true}).click();
  await until('ten selected invitations',async()=>{const n=(await db.query("SELECT count(*)::int n FROM tpa.onboarding_mail WHERE kind='invitation'")).rows[0].n;return n===10?true:undefined;});
  member=(await db.query('SELECT p.id person_id,p.user_id FROM tpa.people p WHERE p.contact_email=$1',[recipient])).rows[0];
  await request('/api/staff/member-actions',{personId:member.person_id,action:'invite'},adminCookie,409);await request('/api/staff/member-actions',{personId:member.person_id,action:'resend'},adminCookie,409);
  // Run the nine non-mailbox jobs through controlled provider fixtures, never the real provider.
  const actualJob=(await queueSnapshot())[0];
  await db.query("UPDATE tpa.onboarding_mail SET available_at=now()+interval '1 day' WHERE recipient=$1 AND status='queued'",[recipient]);
  for(let i=0;i<9;i++)await runOnboardingTick(db,env,{quota:async()=>quota,request:async(_path,_key,body:unknown)=>{const to=(body as {to:string[]}).to;assert.ok(!approved.includes(to[0]));assert.ok(to[0].endsWith('@example.invalid'));return {id:'controlled_'+randomUUID()};}});
  assert.equal((await db.query("SELECT count(*)::int n FROM tpa.onboarding_mail WHERE provider_id LIKE 'controlled_%'")).rows[0].n,9);
  await db.query('UPDATE tpa.onboarding_mail SET available_at=now() WHERE id=$1',[actualJob.id]);
  await startMailWorker();
  evidence.scenarios.B={passed:true,selected:10,realRecipients:1,controlledInvitations:9,duplicateBlocked:true,resendBlocked:true};await save();
  const invitation=await delivered(actualJob.id,'invitation');
  const inviteLink=/(http:\/\/127\.0\.0\.1:3139\/invitation#token=[\w-]+)/.exec(invitation.text??'')?.[1];assert.ok(inviteLink);
  const password='Synthetic-Staging-Activation-2026!';
  await mp.goto(inviteLink);await mp.getByLabel('New password',{exact:true}).fill(password);
  await mp.getByRole('button',{name:'Set password',exact:true}).click();
  await check(mp.getByRole('heading',{name:'Account activated.'})).toBeVisible();
  await request('/api/onboarding/invitation',{token:inviteLink.split('token=')[1],password},adminCookie,410);
  const signIn=await mp.request.post(base+'/api/auth/sign-in/email',{headers:{Origin:base},data:{email:recipient,password}});assert.equal(signIn.status(),200);
  const memberCookieValue=(await memberContext.cookies()).find(c=>c.name==='better-auth.session_token')!.value;
  evidence.scenarios.C={passed:true,providerDeliveredLink:true,activated:true,signedIn:true,singleUse:true};await save();
  console.log('B/C passed: selected invitations, delivered-link activation and actual password sign-in.');

  // Existing recovery is synchronous; preserve that contract rather than claiming an outbox send.
  await request('/api/auth/request-password-reset',{email:recipient,redirectTo:base+'/reset-password'});
  const receipt=await until('recovery receipt',async()=>{const r=(await db.query("SELECT provider_id FROM tpa.email_receipts WHERE user_id=$1 AND kind='recovery' ORDER BY created_at DESC LIMIT 1",[member.user_id])).rows[0];return r?.provider_id?r:undefined;});
  const recovery=await until('recovery delivered',async()=>{const m=await providerRequest('/emails/'+receipt.provider_id,readiness.env.RESEND_RECEIVING_API_KEY!);return m.last_event==='delivered'?m:undefined;});
  const recoveryEvents=await until('recovery signed event',async()=>{const r=(await root.query("SELECT type FROM tpa.email_events WHERE provider_id=$1 AND type='email.delivered'",[receipt.provider_id])).rows;return r.length?r:undefined;});
  evidence.emails.push({label:'recovery',providerId:receipt.provider_id,subject:recovery.subject,providerAccepted:true,providerDelivered:true,signedHostedEvents:recoveryEvents.map(r=>r.type),transport:'existing synchronous recovery',mailboxReceived:false});
  const resetToken=/#token=([\w-]+)/.exec(recovery.text??'')?.[1];assert.ok(resetToken);
  const newPassword='Synthetic-Staging-Recovered-2026!';await request('/api/auth/reset-password',{token:resetToken,newPassword});
  await request('/api/auth/reset-password',{token:resetToken,newPassword},adminCookie,400);
  const oldLogin=await mp.request.post(base+'/api/auth/sign-in/email',{headers:{Origin:base},data:{email:recipient,password}});assert.equal(oldLogin.status(),401);
  const newLogin=await mp.request.post(base+'/api/auth/sign-in/email',{headers:{Origin:base},data:{email:recipient,password:newPassword}});assert.equal(newLogin.status(),200);
  mc=(await memberContext.cookies()).find(c=>c.name==='better-auth.session_token')!.value;
  const oldSession=await fetch(base+'/api/auth/get-session',{headers:{Cookie:'better-auth.session_token='+memberCookieValue}});assert.equal(await oldSession.json(),null);
  evidence.recovery={passed:true,providerDeliveredLink:true,singleUse:true,oldPasswordRejected:true,oldSessionRevoked:true};await save();
  }

  const startsAt=new Date(Date.now()+3*86400000).toISOString(),endsAt=new Date(Date.now()+3*86400000+3600000).toISOString();
  const eventInput={title:'STAGING TEST — operational workshop '+runId.slice(11,16),description:'Synthetic acceptance only. No real payment or attendance.',location:'STAGING TEST room',startsAt,endsAt,capacity:20,feePaise:75000,visibility:'public',deliveryMode:'location',registrationStartsAt:new Date(Date.now()-3600000).toISOString(),registrationEndsAt:new Date(Date.now()+2*86400000).toISOString()};
  let event=await request('/api/staff/events',{action:'save',version:0,...eventInput});event=await request('/api/staff/events',{action:'publish',id:event.id,version:event.version});
  await mp.goto(base+'/member/events');await mp.getByRole('button',{name:'Reserve place · payment required',exact:true}).click();await check(mp.getByText('Place reserved pending manual payment verification.',{exact:true})).toBeVisible();
  let reg=(await db.query('SELECT * FROM tpa.event_registrations WHERE user_id=$1 AND event_id=$2',[member.user_id,event.id])).rows[0];assert.equal(reg.payment_status,'pending');
  await request('/api/member/events',{action:'register',eventId:event.id},mc);
  assert.equal((await db.query('SELECT count(*)::int n FROM tpa.event_registrations WHERE event_id=$1',[event.id])).rows[0].n,1);
  const pending=await deliverNewest('registration pending');assert.match(pending.text,/not a payment confirmation/i);
  evidence.scenarios.D={passed:true,draftPublished:true};evidence.scenarios.E={passed:true,browserRegistered:true,duplicates:0};evidence.scenarios.F={passed:true,pendingExplicit:true};await save();
  await request('/api/staff/registration-payments',undefined,mc,403);
  await request('/api/staff/registration-payments',{id:reg.id,version:reg.version,status:'paid',reference:'',note:'Simulated verification'},adminCookie,400);
  await page.goto(base+'/admin/workspaces/payments');await page.getByRole('button',{name:'Review payment',exact:true}).click();
  await page.getByLabel('New status').selectOption('paid');await page.getByLabel('Bank / payment reference').fill('FAKE-STAGING-001');await page.getByLabel('Verification note').fill('SIMULATED PAYMENT: no funds transferred. Staging acceptance only.');
  await page.getByRole('button',{name:'Confirm status change',exact:true}).click();
  await until('UI payment confirmation',async()=>{const r=(await db.query('SELECT * FROM tpa.event_registrations WHERE id=$1',[reg.id])).rows[0];return r.payment_status==='paid'?r:undefined;});
  await request('/api/staff/registration-payments',{id:reg.id,version:reg.version,status:'paid',reference:'FAKE-STAGING-001',note:'Duplicate simulation'},adminCookie,409);
  const paid=await deliverNewest('payment confirmation');assert.match(paid.text,/registration is confirmed/i);
  await page.getByLabel(/^Payment status/).selectOption('paid');await check(page.getByRole('button',{name:'Review payment',exact:true})).toBeVisible();await page.getByRole('button',{name:'Review payment',exact:true}).click();await check(page.getByLabel('Bank / payment reference')).toHaveValue('FAKE-STAGING-001');await page.screenshot({path:dir+'/payment-confirmed.png',fullPage:true});
  await page.goto(base+'/admin/workspaces/events?id='+event.id);await page.getByLabel(/^Registration status/).selectOption('confirmed');await check(page.getByRole('cell').filter({hasText:/confirmed/})).toBeVisible();await page.screenshot({path:dir+'/final-registration.png',fullPage:true});
  await mp.reload();await check(mp.getByText('Registration confirmed',{exact:true})).toBeVisible();await mp.screenshot({path:dir+'/member-confirmation.png',fullPage:true});
  const audit=(await db.query('SELECT actor_user_id,action,created_at FROM tpa.audit_events WHERE entity_id=$1',[reg.id])).rows;
  assert.ok(audit.some(r=>r.action==='payment.pending_to_paid' && r.actor_user_id===admin && r.created_at));
  evidence.scenarios.G={passed:true,browserVerified:true,fakeReference:'FAKE-STAGING-001',staleBlocked:true};evidence.scenarios.H={passed:true,confirmedRoster:true,memberConfirmed:true,audit};await save();

  const updated=await request('/api/staff/events',{action:'save',id:event.id,version:event.version,...eventInput,location:'STAGING TEST updated room'});
  const update=await deliverNewest('event update');assert.match(update.text,/updated room/);
  await request('/api/staff/events',{action:'save',id:event.id,version:event.version,...eventInput,location:'STAGING TEST updated room'},adminCookie,409);
  assert.equal((await db.query("SELECT count(*)::int n FROM tpa.onboarding_mail WHERE kind='event_update'")).rows[0].n,1);
  evidence.eventUpdate={passed:true,duplicateBlocked:true,version:updated.version};
  // Keep the remaining payment edge notifications in controlled fixtures to avoid needless inbox noise.
  if(mailWorker && mailWorker.exitCode===null && mailWorker.signalCode===null){mailWorker.kill('SIGTERM');await new Promise(r=>mailWorker!.once('exit',r));}
  reg=(await db.query('SELECT * FROM tpa.event_registrations WHERE id=$1',[reg.id])).rows[0];
  await request('/api/staff/registrations',{action:'cancel',id:reg.id,version:reg.version});reg=(await db.query('SELECT * FROM tpa.event_registrations WHERE id=$1',[reg.id])).rows[0];assert.equal(reg.payment_status,'paid');
  await request('/api/staff/registration-payments',{id:reg.id,version:reg.version,status:'refunded',reference:'FAKE-REFUND-001',note:'SIMULATED REFUND: no money transferred.'});
  const refunded=(await db.query('SELECT * FROM tpa.event_registrations WHERE id=$1',[reg.id])).rows[0];assert.equal(refunded.payment_status,'refunded');assert.equal(refunded.status,'cancelled');
  const retryEvent=await request('/api/staff/events',{action:'save',version:0,...eventInput,title:'STAGING TEST failed payment retry'});const publishedRetry=await request('/api/staff/events',{action:'publish',id:retryEvent.id,version:retryEvent.version});
  const retryReg=await request('/api/member/events',{action:'register',eventId:publishedRetry.id},mc);
  await request('/api/staff/registration-payments',{id:retryReg.id,version:retryReg.version,status:'failed',reference:'FAKE-FAILED-001',note:'SIMULATED failure.'});
  const currentFailed=(await db.query('SELECT * FROM tpa.event_registrations WHERE id=$1',[retryReg.id])).rows[0];assert.equal(currentFailed.payment_status,'failed');
  await request('/api/staff/registration-payments',{id:retryReg.id,version:currentFailed.version,status:'pending',reference:'FAKE-RETRY-001',note:'SIMULATED retry.'});
  evidence.paymentEdges={passed:true,cancellationPreservesPaid:true,simulatedRefund:true,failedToPending:true};
  const forged=await fetch(base+'/api/webhooks/resend',{method:'POST',headers:{'Content-Type':'application/json','svix-id':'invalid_test'},body:'{}'});assert.equal(forged.status,400);
  for(const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844}]){await page.setViewportSize(viewport);await page.goto(base+'/admin');await check(page.getByText('Total members')).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:dir+'/dashboard-'+viewport.width+'.png',fullPage:true});}
  assert.equal(browserErrors.length,0);assert.equal((await readFile('.next/BUILD_ID','utf8')).trim(),evidence.buildId,'Shared build changed during acceptance.');
  evidence.automatedAcceptancePassed=true;evidence.pending=['Recipient mailbox confirmation'];console.log('A–H browser/API/payment acceptance and five actual provider deliveries passed. Mailbox receipt remains pending.');
}catch(error){evidence.failure=error instanceof Error?error.message.replace(/#token=[^\s]+/g,'#token=[redacted]'):'Acceptance failed';console.error('Staging acceptance failed: '+evidence.failure);process.exitCode=1;}
finally{
  await browser?.close();
  for(const c of children.reverse())if(c.exitCode===null){c.kill('SIGTERM');await Promise.race([new Promise(r=>c.once('exit',r)),wait(10000)]);if(c.exitCode===null)c.kill('SIGKILL');}
  let localProviderIds:string[]=[];
  if(created){try{localProviderIds=(await db.query("SELECT provider_id FROM tpa.onboarding_mail WHERE provider_id IS NOT NULL AND provider_id NOT LIKE 'controlled_%' UNION SELECT provider_id FROM tpa.email_receipts")).rows.map(r=>r.provider_id);}catch{/* Schema initialization may itself have failed. */}}
  await db.end();if(created){await root.query('DROP DATABASE IF EXISTS '+name+' WITH (FORCE)');evidence.disposableDatabaseRemoved=true;}
  // Only our provider IDs: remove test-event projections created by normal hosted webhooks.
  const ids=[...new Set([...evidence.emails.map(m=>m.providerId).filter(Boolean),...localProviderIds])];
  if(ids.length){const client=await root.connect();try{await client.query('BEGIN');await client.query('DELETE FROM tpa.onboarding_mail_events WHERE provider_id=ANY($1::text[])',[ids]);await client.query('DELETE FROM tpa.email_events WHERE provider_id=ANY($1::text[])',[ids]);await client.query('COMMIT');evidence.hostedTestEventCleanup=true;}catch{await client.query('ROLLBACK');evidence.hostedTestEventCleanup=false;}finally{client.release();}}
  await root.end();evidence.providerRetainedMessageIds=ids;evidence.completedAt=new Date().toISOString();await save();console.log('Evidence: '+dir+'/acceptance.json');
}
