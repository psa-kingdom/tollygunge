import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {Pool} from 'pg';
import {chromium,expect} from '@playwright/test';
import {PNG} from 'pngjs';
import {databaseOptions} from '../src/lib/database-options';
import {scheduleEventPromotions,promotionJobEligibility} from '../src/lib/event-promotion';
import {processEmailJob} from '../src/lib/email-worker';
import {EmailProviderError} from '../src/lib/email-provider';
import {restrictedWorkerPool} from '../tests/helpers/restricted-worker-pool.mjs';
import {defaultPromotion} from '../src/domain/event-engagement';

// All DB writes are in a disposable database. R2 and email transport are localhost/mocked.
const database='tpa_engagement_test_'+randomUUID().replaceAll('-','');assert.match(database,/^tpa_engagement_test_[a-f0-9]{32}$/);
const dir='.local/event-engagement/'+new Date().toISOString().replaceAll(':','-');await mkdir(dir,{recursive:true});
const base='http://127.0.0.1:'+(process.env.TPA_ENGAGEMENT_TEST_PORT??'3156');
const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+database;
assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Engagement acceptance requires local PostgreSQL; hosted database writes are not permitted.');
const env:NodeJS.ProcessEnv={...process.env,DATABASE_URL:url.href,TPA_DATABASE_NAME:database,BETTER_AUTH_URL:base,BETTER_AUTH_SECRET:'synthetic-engagement-secret-over-32-characters',ONBOARDING_ENABLED:'true',EVENT_PROMOTIONS_ENABLED:'false',EMAIL_OPERATIONS_ENABLED:'false',RESEND_DOMAIN_VERIFIED:'false',MEMBER_IMPORT_WORKER_ENABLED:'false'};
for(const key of Object.keys(env))if(/^(RESEND_.*KEY|SMTP_|R2_|GOOGLE_|CLOUDFLARE_CREDENTIAL|NODE_OPTIONS)/.test(key))env[key]='';
Object.assign(env,{R2_ACCOUNT_ID:'0'.repeat(32),R2_ACCESS_KEY_ID:'synthetic-access',R2_SECRET_ACCESS_KEY:'synthetic-secret',R2_BUCKET_NAME:'tpa-private-documents'});
const objects=new Map<string,{bytes:Buffer;type:string}>();let failPut=false;
const storage=createServer(async(req,res)=>{const key=req.url!.split('?')[0];if(req.method==='PUT'){if(failPut){res.writeHead(500,{'Content-Type':'application/xml'});res.end('<Error><Code>InternalError</Code></Error>');return;}const chunks=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));objects.set(key,{bytes:Buffer.concat(chunks),type:String(req.headers['content-type'])});res.writeHead(200);res.end();}else if(req.method==='DELETE'){objects.delete(key);res.writeHead(204);res.end();}else if(req.method==='GET'){const object=objects.get(key);if(!object){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':object.type,'Content-Length':object.bytes.length});res.end(object.bytes);}else{res.writeHead(405);res.end();}});
await new Promise<void>(r=>storage.listen(0,'127.0.0.1',r));const storagePort=(storage.address() as {port:number}).port;
const shim=resolve(dir,'storage-shim.cjs');await writeFile(shim,`const https=require('node:https'),http=require('node:http');const original=https.request;https.request=function(options,callback){if((options.hostname??options.host)?.endsWith('.r2.cloudflarestorage.com'))return http.request({...options,hostname:'127.0.0.1',host:undefined,port:${storagePort},protocol:'http:',agent:undefined},callback);return original.apply(this,arguments);};`);
const root=new Pool(databaseOptions()),db=new Pool({...databaseOptions(env),max:5});let workerDb:Pool=db;let created=false,server:ReturnType<typeof spawn>|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
const evidence={passed:false,buildId:(await readFile('.next/BUILD_ID','utf8')).trim(),syntheticOnly:true,externalEmails:0,externalStorageWrites:0,scenarios:[] as string[],screenshots:[] as string[],browserErrors:[] as string[]};
const users:string[]=[],cookies:string[]=[];
function pass(s:string){evidence.scenarios.push(s);console.log('PASS: '+s);}
async function unavailableFlyer(id:string,title:string,actor?:number) {
 const r=await fetch(base+'/flyers/'+id,{headers:actor===undefined?{}:{Cookie:'better-auth.session_token='+cookies[actor]}}),html=await r.text();
 assert.ok([200,404].includes(r.status));
 assert.ok(html.includes('A little off the beaten path.'));
 assert.match(html,/name="robots" content="noindex[^"]*"/);
 assert.ok(!html.includes(title),'Unavailable flyer must not expose its event title');
}
async function api(path:string,body?:unknown,actor=0,status=200){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:'better-auth.session_token='+cookies[actor],Origin:base,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await response.json();assert.equal(response.status,status,`${path}: ${JSON.stringify(data)}`);return data;}
async function event(visibility='public',past=false){const id=randomUUID();await db.query(`INSERT INTO tpa.events(id,title,description,location,starts_at,ends_at,capacity,status,updated_by,visibility,speakers,fee_paise) VALUES($1,$2,'Professional event','Test hall',$3,$4,10,'published',$5,$6,$7,0)`,[id,past?'Historical workshop':'Engagement workshop',new Date(Date.now()+(past?-7200000:86400000)),new Date(Date.now()+(past?-3600000:90000000)),users[0],visibility,JSON.stringify([{name:'Dr. Educator',credentials:'CA',designation:'Director',organization:'TPA',description:'Professional educator'}])]);return (await db.query('SELECT * FROM tpa.events WHERE id=$1',[id])).rows[0];}
async function registration(eventId:string,actor=1,payment='not_required'){const id=randomUUID();await db.query("INSERT INTO tpa.event_registrations(id,event_id,user_id,status,payment_status) VALUES($1,$2,$3,'registered',$4)",[id,eventId,users[actor],payment]);return id;}
async function upload(eventId:string,eligibility:string,actor=0,status=200,selectedMembers:string[]=[]) {const png=new PNG({width:2,height:2});png.data.fill(255);const data=new FormData();data.set('details',JSON.stringify({eventId,title:'Protected '+eligibility,description:'Event material',type:'notes',eligibility,selectedMembers,status:'published'}));data.set('file',new Blob([new Uint8Array(PNG.sync.write(png))],{type:'image/png'}),'notes.png');const response=await fetch(base+'/api/staff/event-assets',{method:'POST',headers:{Cookie:'better-auth.session_token='+cookies[actor],Origin:base},body:data});const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;}
try {
 await root.query(`CREATE DATABASE ${database}`);created=true;
 const files=(await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort();await db.query('BEGIN;\n'+(await Promise.all(files.map(f=>readFile('migrations/'+f,'utf8')))).join('\n')+'\nCOMMIT;');
 for(let i=0;i<5;i++){const id=randomUUID(),token=randomBytes(24).toString('hex');users.push(id);await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',[id,i===0?'Engagement administrator':'Engagement member '+i,`engagement${i}@example.invalid`]);if(i===0)await db.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",[id]);if(i===4)await db.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'event_operator')",[id]);if(i===1||i===2){const person=randomUUID();await db.query('INSERT INTO tpa.people(id,user_id,accepted,draft,contact_email) VALUES($1,$2,$3,$3,$4)',[person,id,{name:'Member',addresses:{}},`engagement${i}@example.invalid`]);await db.query("INSERT INTO tpa.memberships(id,person_id,membership_number,source,status) VALUES($1,$2,$3,'staff','active')",[randomUUID(),person,'ENG-'+i]);await db.query("INSERT INTO tpa.newsletter_consents(user_id,subscribed,source) VALUES($1,true,'test')",[id]);}await db.query('INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'2 hours\',now())',[randomUUID(),token,id]);cookies.push(encodeURIComponent(token+'.'+createHmac('sha256',env.BETTER_AUTH_SECRET!).update(token).digest('base64')));}
 workerDb=await restrictedWorkerPool(db,env,'email');
 assert.equal((await db.query('SELECT count(*)::int n FROM tpa.event_badge_rules WHERE enabled')).rows[0].n,0);pass('Additive migrations and disabled badge defaults');
 const log=openSync(dir+'/server.log','w');server=spawn(process.execPath,['--require',shim,'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',new URL(base).port],{env,stdio:['ignore',log,log]});closeSync(log);
 let ready=false;for(let i=0;i<60;i++){if(server.exitCode!==null)throw Error('Server exited');try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);
 const e=await event(),privateEvent=await event('members'),past=await event('public',true),draft=await event();await db.query("UPDATE tpa.events SET status='draft' WHERE id=$1",[draft.id]);
 assert.ok((await api('/api/staff/flyers?id='+draft.id)).some((row:{id:string})=>row.id===draft.id));
 const draftVariant=await api('/api/staff/flyer-variants',{eventId:draft.id,eventVersion:draft.version,name:'Draft preview',headline:'Coming soon',presentation:{accent:'gold'},status:'draft'});
 await api('/api/staff/flyer-variants',{...draftVariant,eventId:draft.id,eventVersion:draft.version,status:'published'},0,409);await unavailableFlyer(draftVariant.id,draft.title);
 const variant=await api('/api/staff/flyer-variants',{eventId:e.id,eventVersion:e.version,name:'Registration opening',headline:'Register now',presentation:{accent:'gold'},status:'published'});
 await api('/api/staff/flyer-variants',{...variant,eventId:e.id,eventVersion:0},0,409);
 const memberVariant=await api('/api/staff/flyer-variants',{eventId:privateEvent.id,eventVersion:privateEvent.version,name:'Member flyer',headline:'Members welcome',presentation:{accent:'navy'},status:'published'});
 assert.equal((await fetch(base+'/flyers/'+variant.id)).status,200);await unavailableFlyer(memberVariant.id,privateEvent.title);
 assert.equal((await fetch(base+'/flyers/'+memberVariant.id,{headers:{Cookie:'better-auth.session_token='+cookies[1]}})).status,200);await unavailableFlyer(memberVariant.id,privateEvent.title,3);
 await db.query("UPDATE tpa.events SET title='Updated canonical workshop',version=version+1 WHERE id=$1",[e.id]);assert.ok((await (await fetch(base+'/flyers/'+variant.id)).text()).includes('Updated canonical workshop'));pass('Variant conflicts, canonical event updates and public/member flyer authorization');
 const attendedReg=await registration(past.id,1),absentReg=await registration(past.id,2);await db.query("INSERT INTO tpa.event_attendance(registration_id,checked_in_by,outcome) VALUES($1,$3,'attended'),($2,$3,'absent')",[attendedReg,absentReg,users[0]]);
 const rule=(await api('/api/staff/event-badges'))[0];await api('/api/staff/event-badges',{...rule,enabled:true});
 assert.equal((await api('/api/member/event-journey',undefined,1)).attendanceCount,1);assert.equal((await api('/api/member/event-journey',undefined,2)).attendanceCount,0);
 assert.equal((await api('/api/member/event-journey',undefined,1)).badges.length,1);await api('/api/staff/event-badges',{...rule,enabled:true},0,409);pass('Verified historical attendance earns badges; absent rows and stale rule updates do not');
 const enabledRule=(await api('/api/staff/event-badges')).find((b:{id:string})=>b.id===rule.id);const disabledRule=await api('/api/staff/event-badges',{...enabledRule,enabled:false});assert.equal((await api('/api/member/event-journey',undefined,1)).badges.length,0);const higherRule=await api('/api/staff/event-badges',{...disabledRule,enabled:true,threshold:5});assert.equal((await api('/api/member/event-journey',undefined,1)).badges.length,0);await api('/api/staff/event-badges',{...higherRule,threshold:1});
 const resources:Record<string,Awaited<ReturnType<typeof upload>>>={};
 for(const eligibility of ['public','members','confirmed','attended','selected','finance']) resources[eligibility]=await upload(past.id,eligibility,0,200,eligibility==='selected'?[users[2]]:[]);
 for(const [eligibility,resource] of Object.entries(resources)){
  const anonymous=await fetch(base+'/api/event-assets/'+resource.id);assert.equal(anonymous.status,eligibility==='public'?200:404);if(anonymous.ok)assert.ok((await anonymous.arrayBuffer()).byteLength>0);
  for(const actor of [1,2,3,4]){const allowed=actor===4&&eligibility!=='finance'||eligibility==='public'||eligibility==='members'&&[1,2].includes(actor)||eligibility==='confirmed'&&[1,2].includes(actor)||eligibility==='attended'&&actor===1||eligibility==='selected'&&actor===2;const response=await fetch(base+'/api/event-assets/'+resource.id,{headers:{Cookie:'better-auth.session_token='+cookies[actor]}});assert.equal(response.status,allowed?200:404,`${eligibility} actor ${actor}`);if(response.ok){assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('location'),null);}}
 }
 assert.ok(!(await api('/api/member/event-journey',undefined,1)).resources.some((r:{id:string})=>r.id===resources.finance.id));
 await db.query("UPDATE tpa.event_registrations SET status='cancelled' WHERE id=$1",[attendedReg]);assert.equal((await api('/api/member/event-journey',undefined,1)).attendanceCount,1);assert.equal((await fetch(base+'/api/event-assets/'+resources.attended.id,{headers:{Cookie:'better-auth.session_token='+cookies[1]}})).status,404);await db.query("UPDATE tpa.event_registrations SET status='registered',payment_status='pending' WHERE id=$1",[attendedReg]);assert.equal((await fetch(base+'/api/event-assets/'+resources.attended.id,{headers:{Cookie:'better-auth.session_token='+cookies[1]}})).status,404);await db.query("UPDATE tpa.event_registrations SET payment_status='not_required' WHERE id=$1",[attendedReg]);
 await api('/api/staff/event-assets',{...resources.finance,eventId:past.id,selectedMembers:[],eligibility:'public'},4,403);
 await upload(past.id,'finance',4,403);
 const archived=await api('/api/staff/event-assets',{...resources.attended,eventId:past.id,selectedMembers:[],status:'archived'});assert.equal((await fetch(base+'/api/event-assets/'+archived.id,{headers:{Cookie:'better-auth.session_token='+cookies[1]}})).status,404);
 await api('/api/staff/event-assets',{...resources.attended,eventId:past.id,selectedMembers:[],status:'published'},0,409);
 await db.query('UPDATE tpa.events SET completed_at=now() WHERE id=$1',[past.id]);await api('/api/staff/event-assets',{...archived,eventId:past.id,selectedMembers:[],status:'published'},0,409);await db.query('UPDATE tpa.events SET completed_at=NULL WHERE id=$1',[past.id]);
 failPut=true;const before=objects.size;await upload(past.id,'members',0,503);failPut=false;assert.equal(objects.size,before);
 const link=await api('/api/staff/event-assets',{eventId:past.id,title:'Workshop recording',description:'',type:'other',eligibility:'attended',status:'published',url:'https://example.invalid/recording'});
 assert.equal((await fetch(base+'/api/event-assets/'+link.id,{redirect:'manual',headers:{Cookie:'better-auth.session_token='+cookies[1]}})).status,303);assert.equal((await fetch(base+'/api/event-assets/'+link.id,{redirect:'manual',headers:{Cookie:'better-auth.session_token='+cookies[2]}})).status,404);pass('Private upload/streaming, all audience rules, finance isolation, archive/conflicts, completion guards and storage failure compensation');
 const promotion=await api('/api/staff/event-promotions?eventId='+e.id);assert.equal(promotion.globallyEnabled,false);assert.equal(promotion.eligible,2);
 await api('/api/staff/event-promotions',{eventId:e.id,version:0,settings:{...defaultPromotion,registration_open:true}},4,403);
 await api('/api/staff/event-promotions',{eventId:e.id,version:0,settings:{...defaultPromotion,registration_open:true}});
 const savedPromotion=await api('/api/staff/event-promotions?eventId='+e.id);
 const review=await api('/api/staff/event-promotions',{eventId:e.id,version:savedPromotion.version,action:'review'});
 await api('/api/staff/event-promotions',{eventId:e.id,version:savedPromotion.version,action:'approve',reviewToken:review.reviewToken+'tampered'},0,409);
 await db.query('UPDATE tpa.newsletter_consents SET subscribed=false WHERE user_id=$1',[users[2]]);await api('/api/staff/event-promotions',{eventId:e.id,version:savedPromotion.version,action:'approve',reviewToken:review.reviewToken},0,409);await db.query('UPDATE tpa.newsletter_consents SET subscribed=true WHERE user_id=$1',[users[2]]);
 await api('/api/staff/event-promotions',{eventId:e.id,version:savedPromotion.version,action:'approve',reviewToken:review.reviewToken});
 await scheduleEventPromotions(workerDb,new Date(),env);assert.equal((await db.query('SELECT count(*)::int n FROM tpa.event_promotions')).rows[0].n,0);
 const sendEnv={...env,EVENT_PROMOTIONS_ENABLED:'true'};
 await Promise.all([scheduleEventPromotions(workerDb,new Date(),sendEnv),scheduleEventPromotions(workerDb,new Date(),sendEnv)]);assert.equal((await db.query('SELECT count(*)::int n FROM tpa.event_promotions')).rows[0].n,1);
 const jobs=(await db.query('SELECT * FROM tpa.email_jobs ORDER BY user_id')).rows;assert.equal(jobs.length,2);const dispatch=jobs[0].dispatch_id;
 for(const job of jobs)assert.equal(await promotionJobEligibility(workerDb,dispatch,job.user_id),true);
 await db.query("UPDATE tpa.events SET status='cancelled' WHERE id=$1",[e.id]);assert.equal(await promotionJobEligibility(workerDb,dispatch,users[2]),false);await db.query("UPDATE tpa.events SET status='published',booking_closed=true WHERE id=$1",[e.id]);assert.equal(await promotionJobEligibility(workerDb,dispatch,users[2]),false);await db.query('UPDATE tpa.events SET booking_closed=false WHERE id=$1',[e.id]);
 await db.query('UPDATE tpa.event_promotion_settings SET version=version+1 WHERE event_id=$1',[e.id]);assert.equal(await promotionJobEligibility(workerDb,dispatch,users[2]),false);await db.query('UPDATE tpa.event_promotion_settings SET version=version-1 WHERE event_id=$1',[e.id]);
 await registration(e.id,1);assert.equal(await promotionJobEligibility(workerDb,dispatch,users[1]),false);
 await db.query('UPDATE tpa.newsletter_consents SET subscribed=false WHERE user_id=$1',[users[2]]);assert.equal(await promotionJobEligibility(workerDb,dispatch,users[2]),false);await db.query('UPDATE tpa.newsletter_consents SET subscribed=true WHERE user_id=$1',[users[2]]);
 await db.query("UPDATE tpa.memberships SET status='expired' WHERE person_id=(SELECT id FROM tpa.people WHERE user_id=$1)",[users[2]]);assert.equal(await promotionJobEligibility(workerDb,dispatch,users[2]),false);await db.query("UPDATE tpa.memberships SET status='active' WHERE person_id=(SELECT id FROM tpa.people WHERE user_id=$1)",[users[2]]);
 await db.query("INSERT INTO tpa.email_suppressions(email,reason) SELECT lower(email),'complaint' FROM public.\"user\" WHERE id=$1",[users[2]]);assert.equal(await promotionJobEligibility(workerDb,dispatch,users[2]),false);await db.query('DELETE FROM tpa.email_suppressions');
 const target=jobs.find(j=>j.user_id===users[2])!,excluded=jobs.find(j=>j.user_id===users[1])!;let sends=0,transient=true;
 const deps={quota:async()=>({daily:{used:0,limit:1000,resets_at:new Date(Date.now()+86400000).toISOString()},monthly:{used:0,limit:10000,resets_at:new Date(Date.now()+86400000).toISOString()}}),request:async(_path:string,_key:string,payload?:unknown)=>{sends++;assert.ok(JSON.stringify(payload).includes('List-Unsubscribe'));if(transient){transient=false;throw new EmailProviderError(true,false,'synthetic_retry');}return {id:'synthetic-'+sends};}};
 async function lease(jobId:string){await db.query("UPDATE tpa.email_jobs SET status='leased',lease_owner='test',lease_until=now()+interval '2 minutes' WHERE id=$1",[jobId]);}
 await lease(target.id);await processEmailJob(workerDb,target.id,'test',env,deps);assert.equal(sends,0);assert.equal((await db.query('SELECT reason FROM tpa.email_jobs WHERE id=$1',[target.id])).rows[0].reason,'promotion_paused');
 await lease(excluded.id);await processEmailJob(workerDb,excluded.id,'test',sendEnv,deps);assert.equal(sends,0);
 await lease(target.id);await processEmailJob(workerDb,target.id,'test',sendEnv,deps);assert.equal(sends,1);await lease(target.id);await processEmailJob(workerDb,target.id,'test',sendEnv,deps);assert.equal(sends,2);assert.equal((await db.query('SELECT status FROM tpa.email_jobs WHERE id=$1',[target.id])).rows[0].status,'accepted');
 await db.query('UPDATE tpa.events SET version=version+1 WHERE id=$1',[e.id]);assert.equal(await promotionJobEligibility(workerDb,dispatch,users[2]),false);await scheduleEventPromotions(workerDb,new Date(),sendEnv);assert.equal((await db.query('SELECT count(*)::int n FROM tpa.event_promotions')).rows[0].n,1);pass('Promotion pause, concurrency/deduplication, registration/consent/membership/suppression exclusions, retry and accepted-message preservation');
 browser=await chromium.launch({channel:process.env.TPA_BROWSER_CHANNEL??'chrome'});
 for(const width of [1440,768,390]){
  const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});await context.addCookies([{name:'better-auth.session_token',value:cookies[0],url:base}]);const page=await context.newPage();page.on('pageerror',err=>evidence.browserErrors.push(err.message));
  if(width===1440){await page.goto(base+'/admin/workspaces/flyers?id='+draft.id);await page.getByRole('button',{name:'Generate preview',exact:true}).click();await expect(page.getByRole('status')).toContainText('Draft event');await expect(page.locator('img.flyer-preview')).toBeVisible();await page.locator('img.flyer-preview').screenshot({path:`${dir}/draft-flyer.png`});evidence.screenshots.push('draft-flyer.png');}
  await page.goto(base+'/admin/workspaces/flyers?id='+e.id);await page.getByRole('button',{name:'Generate preview',exact:true}).click();await expect(page.locator('img.flyer-preview')).toBeVisible();await page.screenshot({path:`${dir}/flyers-${width}.png`,fullPage:true});evidence.screenshots.push(`flyers-${width}.png`);
  await page.getByLabel('Promotional headline').fill('Last day to register');await expect(page.locator('img.flyer-preview')).toHaveCount(0);await page.getByRole('button',{name:'Generate preview',exact:true}).click();await expect(page.locator('img.flyer-preview')).toBeVisible();
  await db.query('UPDATE tpa.events SET version=version+1 WHERE id=$1',[e.id]);await page.getByRole('button',{name:'Download PNG',exact:true}).click();await expect(page.getByRole('status')).toContainText('Event changed');await expect(page.locator('img.flyer-preview')).toHaveCount(0);
  await page.goto(base+'/admin/workspaces/events?id='+past.id);await page.getByText('Event resources',{exact:true}).click();await page.screenshot({path:`${dir}/resources-${width}.png`,fullPage:true});evidence.screenshots.push(`resources-${width}.png`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('.event-engagement').screenshot({path:`${dir}/resource-panel-${width}.png`});evidence.screenshots.push(`resource-panel-${width}.png`);
  if(width===1440){
   const panel=page.locator('.event-engagement');await panel.getByLabel('Resource title').fill('Browser uploaded notes');await panel.getByLabel('Description',{exact:true}).fill('A protected browser upload');
   const png=new PNG({width:2,height:2});png.data.fill(255);await panel.locator('input[type=file]').setInputFiles({name:'browser-notes.png',mimeType:'image/png',buffer:PNG.sync.write(png)});await panel.getByRole('button',{name:'Upload resource',exact:true}).click();await expect(panel.locator('[aria-live=polite]')).toContainText('Event resource saved');
   await page.goto(base+'/admin/workspaces/events?id='+e.id);const promotionPanel=page.locator('.event-engagement');await promotionPanel.getByText('Event promotion',{exact:true}).click();await promotionPanel.getByRole('button',{name:'Review saved promotion',exact:true}).click();await expect(promotionPanel.getByRole('heading',{name:'Review saved audience and messages',exact:true})).toBeVisible();await promotionPanel.getByRole('button',{name:'Approve saved promotion schedule',exact:true}).click();await expect(promotionPanel.locator('[aria-live=polite]')).toContainText('Saved promotion approved');
  }
  await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body));await context.close();
  const member=await browser.newContext({viewport:{width,height:1000}});await member.addCookies([{name:'better-auth.session_token',value:cookies[1],url:base}]);const memberPage=await member.newPage();memberPage.on('pageerror',err=>evidence.browserErrors.push(err.message));await memberPage.goto(base+'/member/events');await expect(memberPage.getByRole('heading',{name:'Your Event Journey',exact:true})).toBeVisible();await expect(memberPage.getByText('Events attended:',{exact:false})).toContainText('1');await memberPage.screenshot({path:`${dir}/journey-${width}.png`,fullPage:true});evidence.screenshots.push(`journey-${width}.png`);assert.ok(await memberPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await member.close();
 }
 assert.deepEqual(evidence.browserErrors,[]);pass('Desktop/tablet/phone flyer freshness, resource editor, member journey, keyboard focus and responsive layouts');evidence.passed=true;
}finally{
 await writeFile(dir+'/acceptance.json',JSON.stringify(evidence,null,2));await browser?.close();if(server&&server.exitCode===null){const exit=new Promise(r=>server!.once('exit',r));server.kill();await exit;}if(workerDb!==db)await workerDb.end();await db.end();if(created)await root.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);await root.end();await new Promise<void>((r,reject)=>storage.close(err=>err?reject(err):r()));console.log('Evidence: '+dir);
}
