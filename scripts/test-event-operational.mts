import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer,type Server} from 'node:http';
import {mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {Pool} from 'pg';
import {jsPDF} from 'jspdf';
import {scheduleEventPromotions} from '../src/lib/event-promotion';
import {processEmailJob} from '../src/lib/email-worker';
import {scheduleEventReminders,deliverEventReminder} from '../src/lib/event-reminders';
import {chromium,expect} from '@playwright/test';
import {operationalBrowserJourney} from './event-operational-browser.mts';

// This acceptance runner intentionally refuses hosted database connections.
const rootUrl=new URL(process.env.DATABASE_URL ?? '');
assert.equal(rootUrl.hostname,'127.0.0.1','Use the dedicated local QA database');
assert.equal(rootUrl.port,'55439','Use the dedicated QA port');
const name='tpa_event_test_'+randomUUID().replaceAll('-','');
const root=new Pool({connectionString:rootUrl.href,ssl:false});
const dbUrl=new URL(rootUrl);dbUrl.pathname='/'+name;
const db=new Pool({connectionString:dbUrl.href,ssl:false});
const port=Number(process.env.TPA_EVENT_QA_PORT || 3146);
assert.ok(Number.isInteger(port) && port>=3145 && port<=3199);
const base=`http://127.0.0.1:${port}`;
const dir=resolve('.local/event-operational/'+new Date().toISOString().replaceAll(':','-'));
const env:NodeJS.ProcessEnv={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,USERPROFILE:process.env.USERPROFILE};
// Define every dotenv key before Next starts so local production secrets cannot be loaded.
for(const file of ['.env','.env.local','.env.production','.env.production.local']) {
 try {for(const line of (await readFile(file,'utf8')).split(/\r?\n/)){const m=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);if(m)env[m[1]]='';}}catch{}
}
Object.assign(env,{DATABASE_URL:dbUrl.href,DATABASE_SSL:'false',TPA_DATABASE_NAME:name,BETTER_AUTH_URL:base,BETTER_AUTH_SECRET:'synthetic-operational-acceptance-secret-32-characters',TPA_MAIL_SINK:'true',ONBOARDING_ENABLED:'true',EMAIL_OPERATIONS_ENABLED:'false',EVENT_REMINDERS_ENABLED:'true',EVENT_PROMOTIONS_ENABLED:'true',MEMBER_IMPORT_WORKER_ENABLED:'false',TPA_EVENT_TEST_STORAGE_DIR:dir+'/files'});
process.env.BETTER_AUTH_SECRET=env.BETTER_AUTH_SECRET;process.env.BETTER_AUTH_URL=base;
const results={buildId:'',passed:false,syntheticOnly:true,externalEmails:0,cleanup:false,scenarios:[] as string[],screenshots:[] as string[],accessibility:[] as unknown[],failures:[] as string[]};
let storage:Server|undefined;const objects=new Map<string,{bytes:Buffer;type:string}>();
let server:ReturnType<typeof spawn>|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,created=false;
const users:string[]=[],cookies:string[]=[];
const check=expect.configure({timeout:30000});
function pass(s:string){results.scenarios.push(s);console.log('PASS: '+s);}
async function request(path:string,body?:unknown,actor=0,status=200) {
 const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:'better-auth.session_token='+cookies[actor],Origin:base,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json();assert.equal(r.status,status,`${path}: ${JSON.stringify(data)}`);return data;
}
try {
 await mkdir(dir,{recursive:true});results.buildId=(await readFile('.next/BUILD_ID','utf8')).trim();
 await root.query(`CREATE DATABASE ${name}`);created=true;
 const migrations=(await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort();
 for(const file of migrations) await db.query('BEGIN;\n'+await readFile('migrations/'+file,'utf8')+'\nCOMMIT;');
 pass('All additive migrations apply in order to an isolated database');
 if(!process.argv.includes('--migration-only')) {
 for(const role of ['administrator','member','member','guest','event_operator','finance_operator','member']) {
  const id=randomUUID(),token=randomBytes(24).toString('hex');users.push(id);
  await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',[id,role+' '+users.length,`operational${users.length}@example.invalid`]);
  if(['administrator','event_operator','finance_operator'].includes(role))await db.query('INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,$2)',[id,role]);
  if(role==='member') {
   await db.query("INSERT INTO tpa.newsletter_consents(user_id,subscribed,source) VALUES($1,true,'acceptance_fixture')",[id]);
   const person=randomUUID();await db.query('INSERT INTO tpa.people(id,user_id,accepted,draft,contact_email) VALUES($1,$2,$3,$3,$4)',[person,id,{name:role,addresses:{}},`operational${users.length}@example.invalid`]);
   await db.query("INSERT INTO tpa.memberships(id,person_id,membership_number,source,status) VALUES($1,$2,$3,'staff','active')",[randomUUID(),person,'OP-'+users.length]);
  }
  await db.query('INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'2 hours\',now())',[randomUUID(),token,id]);
  cookies.push(encodeURIComponent(token+'.'+createHmac('sha256',env.BETTER_AUTH_SECRET!).update(token).digest('base64')));
 }
 Object.assign(env,{R2_ACCOUNT_ID:'0'.repeat(32),R2_ACCESS_KEY_ID:'synthetic-access',R2_SECRET_ACCESS_KEY:'synthetic-secret',R2_BUCKET_NAME:'tpa-private-documents'});
 storage=createServer(async(req,res)=>{
  const key=new URL(req.url!,'http://127.0.0.1').pathname;console.log('Mock storage:',req.method,key);
  if(req.method==='PUT'){const chunks=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));objects.set(key,{bytes:Buffer.concat(chunks),type:String(req.headers['content-type'])});res.writeHead(200);res.end();}
  else if(req.method==='GET'){const object=objects.get(key);if(!object){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':object.type,'Content-Length':object.bytes.length});res.end(object.bytes);}
  else if(req.method==='DELETE'){objects.delete(key);res.writeHead(204);res.end();}else{res.writeHead(405);res.end();}
 });
 await new Promise<void>(r=>storage!.listen(0,'127.0.0.1',r));const storagePort=(storage.address() as {port:number}).port;
 const shim=resolve(dir,'storage-shim.cjs');
 await writeFile(shim,`const https=require('node:https'),http=require('node:http');https.request=function(options,callback){if((options.hostname??options.host)?.endsWith('.r2.cloudflarestorage.com'))return http.request({...options,hostname:'127.0.0.1',host:undefined,port:${storagePort},protocol:'http:',agent:undefined},callback);throw Error('External HTTPS is disabled during isolated operational acceptance');};`);
 env.NODE_OPTIONS='';
 const fs=await import('node:fs');const log=fs.openSync(dir+'/server.log','w');
 server=spawn(process.execPath,['--require',shim,'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env,stdio:['ignore',log,log]});fs.closeSync(log);
 let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error('Acceptance server exited');try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);
 const account=await request('/api/staff/payment-details',{action:'save',version:0,details:{label:'Workshop UPI',payee:'TPA Test Association',upiId:'tpa-test@example',phone:'',qrId:null}});
 await request('/api/staff/payment-details',{action:'active',id:account.id,version:account.version,confirmPayee:true});
 let event=await request('/api/staff/events',{action:'save',version:0,title:'Professional Practice Workshop',description:'A realistic workshop with presentations and a community discussion.',location:'TPA Test Hall',startsAt:new Date(Date.now()+3*86400000).toISOString(),endsAt:new Date(Date.now()+3*86400000+3600000).toISOString(),capacity:3,feePaise:75000,visibility:'members',deliveryMode:'location',speakers:[{name:'Dr. Workshop Speaker',credentials:'Community educator'}],reminders:{enabled:true,offsets:[1440,60],includePending:true}});
 async function fresh(){event=(await request('/api/staff/events?id='+event.id))[0];return event;}
 async function operation(action:string,extra:Record<string,unknown>={},actor=0,status=200){await fresh();const r=await request('/api/staff/events/operations',{eventId:event.id,version:event.version,action,...extra},actor,status);await fresh();return r;}
 await operation('payment.configure',{accountIds:[account.id],reason:'Verified workshop collection account'});
 event=await request('/api/staff/events',{action:'publish',id:event.id,version:event.version});
 const first=await request('/api/member/events',{action:'register',eventId:event.id},1);
 const second=await request('/api/member/events',{action:'register',eventId:event.id},2);
 await request('/api/member/events',{action:'register',eventId:event.id},3,403);
 const duplicate=await request('/api/member/events',{action:'register',eventId:event.id},1);assert.equal(first.id,duplicate.id);
 pass('Paid member booking, ineligible guest rejection and duplicate reservation');
 await request('/api/member/events',{action:'payment_reference',eventId:event.id,reference:'UPI-TEST-001',version:first.version},1);
 async function registration(id:string){return (await db.query('SELECT * FROM tpa.event_registrations WHERE id=$1',[id])).rows[0];}
 async function payment(id:string,status:string){const r=await registration(id);await request('/api/staff/registration-payments',{id,version:r.version,status,reference:'UPI-TEST-001',note:'Matched isolated statement'});}
 await payment(first.id,'paid');await payment(second.id,'paid');
 const original=(await db.query('SELECT * FROM tpa.event_payment_configurations WHERE event_id=$1 AND revision=$2',[event.id,first.payment_revision])).rows[0];assert.equal(original.accounts[0].details.payee,'TPA Test Association');
 const revisedAccount=await request('/api/staff/payment-details',{action:'save',version:0,details:{label:'Workshop Bank',method:'bank',payee:'TPA New Test Payee',accountNumber:'1234567890',ifsc:'TEST0123456',bank:'Test Bank',branch:'Test Branch',phone:'',qrId:null}});
 await request('/api/staff/payment-details',{action:'active',id:revisedAccount.id,version:revisedAccount.version,confirmPayee:true});
 await operation('payment.configure',{accountIds:[revisedAccount.id],reason:'New payee for subsequent workshop bookings'});
 const third=await request('/api/member/events',{action:'register',eventId:event.id},6);
 assert.notEqual(third.payment_revision,first.payment_revision);
 const newInstructions=await request('/api/member/payment-details?eventId='+event.id,undefined,6);
 assert.equal(newInstructions.records[0].details.payee,'TPA New Test Payee');
 const oldInstructions=await request('/api/member/payment-details?eventId='+event.id,undefined,1);
 assert.equal(oldInstructions.records[0].details.payee,'TPA Test Association');
 const historical=(await db.query('SELECT * FROM tpa.event_payment_configurations WHERE event_id=$1 AND revision=$2',[event.id,first.payment_revision])).rows[0];assert.deepEqual(historical.accounts,original.accounts);
 pass('Submitted reference, staff verification and immutable historical payee configuration');
 await request('/api/member/events',{action:'cancel',eventId:event.id},2);await payment(second.id,'refunded');
 const overview=await request('/api/staff/events/operations?eventId='+event.id);assert.equal(overview.financials.received,150000);assert.equal(overview.financials.refunded,75000);
 const restricted=await request('/api/staff/events/operations?eventId='+event.id,undefined,4);assert.equal(restricted.financials,null);assert.deepEqual(restricted.expenses,[]);
 await operation('expense.save',{category:'venue',description:'Workshop hall rental',date:'2026-10-12',amountPaise:25000},4,403);
 await operation('expense.save',{category:'venue',description:'Workshop hall rental',date:'2026-10-12',amountPaise:25000});
 await operation('expense.save',{category:'catering',description:'Tea and refreshments',date:'2026-10-12',amountPaise:12500});
 await operation('expense.save',{category:'printing',description:'Temporary printing estimate',date:'2026-10-12',amountPaise:200});
 let temporary=(await request('/api/staff/events/operations?eventId='+event.id)).expenses.find((x:{description:string})=>x.description==='Temporary printing estimate');
 await operation('expense.save',{id:temporary.id,expenseVersion:temporary.version,category:'printing',description:'Corrected printing estimate',date:'2026-10-12',amountPaise:100});
 temporary=(await request('/api/staff/events/operations?eventId='+event.id)).expenses.find((x:{id:string})=>x.id===temporary.id);
 await operation('expense.void',{id:temporary.id,expenseVersion:temporary.version,reason:'Estimate did not become an expense'});
 const totals=(await request('/api/staff/events/operations?eventId='+event.id)).financials;assert.equal(totals.netResult,37500);assert.equal(totals.pending,75000);
 pass('Refund and expense totals reconcile; event operators cannot access financial data or write expenses');
 await operation('perk.grant',{registrationId:first.id,title:'Workshop reading pack',notes:'Available at the workshop desk'});
 const perk=(await request('/api/staff/events/operations?eventId='+event.id)).entitlements.find((p:{title:string})=>p.title==='Workshop reading pack');
 const ownPerks=await request('/api/member/events/operations?eventId='+event.id,undefined,1);assert.ok(ownPerks.perks.some((p:{id:string})=>p.id===perk.id));
 const otherPerks=await request('/api/member/events/operations?eventId='+event.id,undefined,6);assert.ok(!otherPerks.perks.some((p:{id:string})=>p.id===perk.id));
 await operation('perk.revoke',{id:perk.id,perkVersion:perk.version});assert.ok((await request('/api/member/events/operations?eventId='+event.id,undefined,1)).perks[0].revoked_at);
 await operation('announcement.save',{subject:'Workshop joining instructions',body:'Please arrive fifteen minutes before the workshop.'});
 const announcement=(await request('/api/staff/events/operations?eventId='+event.id)).announcements[0];
 await operation('announcement.send',{id:announcement.id,announcementVersion:announcement.version});
 await operation('announcement.send',{id:announcement.id,announcementVersion:announcement.version},0,409);
 const notices=(await db.query("SELECT dedupe FROM tpa.onboarding_mail WHERE event_id=$1 AND dedupe LIKE 'event-announcement-%'",[event.id])).rows;assert.equal(notices.length,2);assert.equal(new Set(notices.map(x=>x.dedupe)).size,2);
 pass('Perk ownership; announcement send rejects replay without duplicate messages');pass('Perk revocation is reflected in member history');
 const free=await request('/api/staff/events',{action:'save',version:0,title:'Free Attendance Companion',description:'A free community session.',location:'Test room',startsAt:new Date(Date.now()+86400000).toISOString(),endsAt:new Date(Date.now()+90000000).toISOString(),capacity:5,feePaise:0});
 await request('/api/staff/events',{action:'publish',id:free.id,version:free.version});
 const freeFirst=await request('/api/member/events',{action:'register',eventId:free.id},1),freeSecond=await request('/api/member/events',{action:'register',eventId:free.id},2);
 assert.equal(freeFirst.payment_status,'not_required');
 await db.query("UPDATE tpa.events SET starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' WHERE id=$1",[free.id]);
 const batch=await request('/api/staff/attendance',{eventId:free.id,outcome:'attended',note:'Companion attendance reconciliation',entries:[{id:freeFirst.id,version:freeFirst.version,attendanceVersion:0},{id:freeSecond.id,version:freeSecond.version+1,attendanceVersion:0}]});
 assert.equal(batch.results[0].saved,true);assert.equal(batch.results[1].saved,false);
 const filtered=await request('/api/staff/attendance?eventId='+free.id+'&page=1&attendance=attended');assert.equal(filtered.total,1);assert.equal(filtered.rows[0].id,freeFirst.id);
 pass('Free booking, per-row bulk attendance conflict reporting and paged attendance filtering');
 // Controlled fixture clock: boundary setup, not a missing operator action.
 await db.query("UPDATE tpa.events SET starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',version=version+1 WHERE id=$1",[event.id]);
 await fresh();await operation('complete',{financialReviewed:true},0,409);
 await request('/api/staff/attendance',{registrationId:first.id,outcome:'attended',version:0,note:'Workshop desk attendance'});
 const resourceDocument=new jsPDF();resourceDocument.text('Workshop post-event notes',20,20);const resourceBytes=Buffer.from(resourceDocument.output('arraybuffer'));
 const uploadForm=new FormData();uploadForm.set('details',JSON.stringify({eventId:event.id,title:'Operational presentation',description:'Workshop learning material',type:'presentation',status:'published',eligibility:'attended',selectedMembers:[]}));uploadForm.set('file',new Blob([resourceBytes],{type:'application/pdf'}),'workshop.pdf');
 const upload=await fetch(base+'/api/staff/event-assets',{method:'POST',headers:{Cookie:'better-auth.session_token='+cookies[0],Origin:base},body:uploadForm});
 const asset=await upload.json();assert.equal(upload.status,200,JSON.stringify(asset));
 await operation('attendance.finalize');await operation('complete',{financialReviewed:true});
 assert.ok(event.completed_at);
 const download=await fetch(base+'/api/event-assets/'+asset.id,{headers:{Cookie:'better-auth.session_token='+cookies[1]}});assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),resourceBytes);assert.equal(download.headers.get('Cache-Control'),'private, no-store');
 for(const actor of [2,3,6])assert.equal((await fetch(base+'/api/event-assets/'+asset.id,{headers:{Cookie:'better-auth.session_token='+cookies[actor]}})).status,404);
 assert.equal((await fetch(base+'/api/event-assets/'+asset.id)).status,404);
 const memberHistory=await request('/api/member/events/operations?eventId='+event.id,undefined,1);assert.ok(memberHistory.assets.some((a:{id:string})=>a.id===asset.id));
 pass('Private upload/download bytes match; refunded, guest, pending and anonymous users cannot download attendee resources');
 const badge=(await db.query('SELECT * FROM tpa.event_badges WHERE registration_id=$1',[first.id])).rows[0];assert.ok(badge);assert.equal(badge.revoked_at,null);
 await operation('expense.save',{category:'venue',description:'Frozen event expense',date:'2026-10-12',amountPaise:100},0,409);
 await operation('reopen',{reason:'Audit-approved attendance correction'});
 const attendance=(await request('/api/staff/attendance?eventId='+event.id)).find((a:{id:string})=>a.id===first.id);
 await request('/api/staff/attendance',{registrationId:first.id,outcome:'absent',version:attendance.attendance_version,note:'Corrected desk reconciliation'});
 await operation('attendance.finalize');await operation('complete',{financialReviewed:true});
 assert.ok((await db.query('SELECT revoked_at FROM tpa.event_badges WHERE registration_id=$1',[first.id])).rows[0].revoked_at);
 assert.equal((await fetch(base+'/api/event-assets/'+asset.id,{headers:{Cookie:'better-auth.session_token='+cookies[1]}})).status,404);
 pass('Audited reopening and attendance correction revoke the badge before re-finalization');
 pass('Completion requires attendance reconciliation, awards a badge and freezes operational changes');
 if(process.argv.includes('--browser')) {
  browser=await chromium.launch({channel:process.env.TPA_BROWSER_CHANNEL || undefined,headless:true});
  for(const width of [1440,768,390]) {
   const context=await browser.newContext({viewport:{width,height:1000}});await context.addCookies([{name:'better-auth.session_token',value:cookies[0],url:base}]);
   const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/admin/workspaces/events?id='+event.id);await check(page.getByRole('region',{name:'Event command center',exact:true})).toBeVisible();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
   await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
   const accessibility=await page.evaluate(async()=>{
    const axe=(window as unknown as {axe:{run:(scope:unknown,options:unknown)=>Promise<{violations:unknown[];incomplete:unknown[]}>}}).axe;
    return axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
   });
   results.accessibility.push({width,...accessibility});
   assert.deepEqual(accessibility.violations,[],`Accessibility violations at ${width}px`);
   const image=`command-center-${width}.png`;await page.screenshot({path:dir+'/'+image,fullPage:true});results.screenshots.push(image);await context.close();
  }
  pass('Command center renders at desktop, tablet and phone sizes without overflow or runtime errors');
  async function communications(eventId:string,stage:'promotion'|'reminder') {
   if(stage==='promotion') {
    await scheduleEventPromotions(db,new Date(),env);await scheduleEventPromotions(db,new Date(),env);
    const jobs=(await db.query('SELECT j.* FROM tpa.email_jobs j JOIN tpa.event_promotions p ON p.dispatch_id=j.dispatch_id WHERE p.event_id=$1',[eventId])).rows;
    assert.equal(jobs.length,3);let sends=0;
    const deps={quota:async()=>({daily:{used:0,limit:1000,resets_at:new Date(Date.now()+86400000).toISOString()},monthly:{used:0,limit:10000,resets_at:new Date(Date.now()+86400000).toISOString()}}),request:async()=>({id:'synthetic-operational-promotion-'+(++sends)})};
    for(const job of jobs){await db.query("UPDATE tpa.email_jobs SET status='leased',lease_owner='operational',lease_until=now()+interval '2 minutes' WHERE id=$1",[job.id]);await processEmailJob(db,job.id,'operational',env,deps);}
    assert.equal(sends,3);assert.equal((await db.query("SELECT count(*)::int n FROM tpa.email_jobs j JOIN tpa.event_promotions p ON p.dispatch_id=j.dispatch_id WHERE p.event_id=$1 AND j.status='accepted'",[eventId])).rows[0].n,3);
    pass('UI-reviewed promotion schedules once and is accepted by mocked transport for three eligible synthetic members');
   } else {
    const e=(await db.query('SELECT starts_at FROM tpa.events WHERE id=$1',[eventId])).rows[0],clock=new Date(new Date(e.starts_at).getTime()-3600000);
    await scheduleEventReminders(db,clock,env);await scheduleEventReminders(db,clock,env);
    const reminders=(await db.query("SELECT d.mail_id FROM tpa.event_reminders d WHERE d.event_id=$1 AND d.audience='confirmed' AND d.offset_minutes=60 AND d.status='queued'",[eventId])).rows;assert.equal(reminders.length,1);
    let sends=0;await deliverEventReminder(db,reminders[0].mail_id,async c=>{sends++;await c.query("UPDATE tpa.onboarding_mail SET status='accepted',provider_id='synthetic-operational-reminder' WHERE id=$1",[reminders[0].mail_id]);},clock);
    await deliverEventReminder(db,reminders[0].mail_id,async()=>{sends++;},clock);assert.equal(sends,1);
    pass('Same workshop confirmed reminder sends once at its configured offset under controlled time');
   }
  }
  try{await operationalBrowserJourney({browser,base,cookies,db,dir,request,pass,communications});}catch(error){for(const [i,page] of browser.contexts().flatMap(c=>c.pages()).entries())await page.screenshot({path:dir+`/failure-page-${i}.png`,fullPage:true}).catch(()=>{});throw error;}
 }
 }
 results.passed=results.failures.length===0;
}catch(error){results.failures.push(String(error));throw error;}finally{
 await browser?.close();server?.kill();if(server&&server.exitCode===null)await new Promise(r=>server!.once('exit',r));
 if(storage)await new Promise<void>((r,reject)=>storage!.close(error=>error?reject(error):r()));objects.clear();
 await db.end();if(created){await root.query(`DROP DATABASE ${name} WITH (FORCE)`);assert.equal((await root.query('SELECT count(*)::int n FROM pg_database WHERE datname=$1',[name])).rows[0].n,0);results.cleanup=true;}await root.end();
 const storagePath=resolve(dir,'files');assert.ok(storagePath.startsWith(dir+sep));await rm(storagePath,{recursive:true,force:true});
 await mkdir(dir,{recursive:true});await writeFile(dir+'/acceptance.json',JSON.stringify(results,null,2));console.log('Evidence: '+dir);
}
