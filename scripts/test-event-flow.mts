import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { chromium, expect } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { databaseOptions } from "../src/lib/database-options";
import { scheduleEventReminders, deliverEventReminder } from "../src/lib/event-reminders";
import { runOnboardingTick } from "../src/lib/onboarding-delivery";
import { openMail } from "../src/lib/onboarding-mail";
import { hashPassword } from "better-auth/crypto";
import { eventLink, istInput } from "../src/domain/event-flow";
import { Webhook } from "svix";
import { EmailProviderError } from "../src/lib/email-provider";
import {verifyPaymentTable} from '../tests/helpers/payment-table-acceptance';

// Creates only a disposable database; external transport credentials are removed.
const workerOnly=process.argv.includes("--worker-only");
const browserOnly=process.argv.includes("--browser-only");
const database = "tpa_event_test_" + randomUUID().replaceAll("-", "");
assert.match(database,/^tpa_event_test_[a-f0-9]{32}$/);
const base = "http://127.0.0.1:" + (process.env.TPA_EVENT_TEST_PORT || "3144");
const dir = ".local/event-flow/" + new Date().toISOString().replaceAll(":","-");
const url = new URL(process.env.DATABASE_URL!); url.pathname = "/" + database;
const env = {...process.env, DATABASE_URL:url.href, TPA_DATABASE_NAME:database, BETTER_AUTH_URL:base,
  BETTER_AUTH_SECRET:"synthetic-event-flow-secret-over-32-characters", ONBOARDING_ENABLED:"true", TPA_MAIL_SINK:"true",
  RESEND_WEBHOOK_SECRET:"whsec_"+randomBytes(32).toString("base64"),
  EVENT_REMINDERS_ENABLED:"true",
  RESEND_DOMAIN_VERIFIED:"false", EMAIL_OPERATIONS_ENABLED:"false", MEMBER_IMPORT_WORKER_ENABLED:"false"};
for(const key of Object.keys(env)) if(/^(RESEND_.*KEY|SMTP_|R2_|GOOGLE_|CLOUDFLARE_CREDENTIAL)/.test(key)) env[key as keyof typeof env] = "";
const root=new Pool({...databaseOptions(),keepAlive:true}),db=new Pool({...databaseOptions(env),max:3,keepAlive:true,idleTimeoutMillis:10000});
root.on("error",()=>console.log("Test database idle connection reset; reconnecting on next query."));
db.on("error",()=>console.log("Test database idle connection reset; reconnecting on next query."));
const workerProcesses:ReturnType<typeof spawn>[]=[];
let server:ReturnType<typeof spawn>|undefined,browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,created=false;
const evidence={mode:workerOnly?"worker":browserOnly?"browser":"full",passed:false,syntheticOnly:true,externalEmails:0,buildId:"",scenarios:[] as string[],screenshots:[] as string[],exports:[] as string[],browserErrors:[] as string[],completed:""};
const check=expect.configure({timeout:30000});
function pass(label:string){evidence.scenarios.push(label);console.log("PASS: "+label);}
async function save(){await writeFile(dir+"/acceptance.json",JSON.stringify(evidence,null,2));}
try {
  await mkdir(dir,{recursive:true});
  evidence.buildId=(await readFile(".next/BUILD_ID","utf8")).trim();
  await root.query(`CREATE DATABASE ${database}`);created=true;
  const files=(await readdir("migrations")).filter(f=>f.endsWith(".sql")).sort();
  const earlier=files.filter(f=>f<"030_");
  await db.query("BEGIN;\n"+(await Promise.all(earlier.map(f=>readFile("migrations/"+f,"utf8")))).join("\n")+"\nCOMMIT;");
  const users:string[]=[],cookies:string[]=[];
  // This identity exercises both an existing login and new-account creation.
  const syntheticPassword="Event!"+randomBytes(3).toString("hex");
  for(const role of ["administrator","member","guest","member","member"]) {
    const id=randomUUID(),token=randomBytes(24).toString("hex");users.push(id);
    await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',[id,role==="administrator"?"Event administrator":"Event member "+users.length,`event${users.length}@example.invalid`]);
    if(role==="administrator") await db.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",[id]);
    if(role==="member") {
      const person=randomUUID();
      await db.query("INSERT INTO tpa.people(id,user_id,accepted,draft,contact_email) VALUES($1,$2,$3,$3,$4)",[person,id,{name:"Event member",email:`event${users.length}@example.invalid`,addresses:{}},`event${users.length}@example.invalid`]);
      await db.query("INSERT INTO tpa.memberships(id,person_id,membership_number,source,status) VALUES($1,$2,$3,'staff','active')",[randomUUID(),person,"EV-"+users.length]);
    }
    await db.query('INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'2 hours\',now())',[randomUUID(),token,id]);
    cookies.push(encodeURIComponent(token+"."+createHmac("sha256",env.BETTER_AUTH_SECRET).update(token).digest("base64")));
  }
  await db.query('INSERT INTO public."account"(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,\'credential\',$2,$3,now(),now())',[randomUUID(),users[4],await hashPassword(syntheticPassword)]);
  const legacy=randomUUID(),legacyRegistration=randomUUID();
  await db.query("INSERT INTO tpa.events(id,title,description,location,starts_at,ends_at,capacity,updated_by) VALUES($1,'Legacy event','','Hall',now()+interval '3 days',now()+interval '3 days 1 hour',10,$2)",[legacy,users[0]]);
  await db.query("INSERT INTO tpa.flyer_templates(event_id,speakers,updated_by) VALUES($1,$2,$3)",[legacy,JSON.stringify([{name:"Legacy speaker",credentials:"Professor"}]),users[0]]);
  await db.query("UPDATE tpa.events SET status='published',fee_paise=12000 WHERE id=$1",[legacy]);
  await db.query("INSERT INTO tpa.event_registrations(id,event_id,user_id,status,fee_paise,payment_status,payment_reference,payment_note) VALUES($1,$2,$3,'registered',12000,'paid','LEGACY-BANK-001','Historical verification retained')",[legacyRegistration,legacy,users[1]]);
  await db.query("BEGIN;\n"+(await Promise.all(files.filter(f=>f>="030_").map(f=>readFile("migrations/"+f,"utf8")))).join("\n")+"\nCOMMIT;");
  const migrated=(await db.query("SELECT * FROM tpa.events WHERE id=$1",[legacy])).rows[0];
  assert.equal(migrated.speakers[0].name,"Legacy speaker");assert.equal(migrated.reminders.enabled,false);
  assert.equal((await db.query("SELECT count(*)::int n FROM tpa.flyer_templates WHERE event_id=$1",[legacy])).rows[0].n,1);
  const legacyHistory=(await db.query("SELECT * FROM tpa.event_payment_history WHERE registration_id=$1",[legacyRegistration])).rows[0];
  assert.equal(legacyHistory.reference,"LEGACY-BANK-001");assert.equal(legacyHistory.fee_paise,12000);
  assert.equal((await db.query("SELECT payment_status FROM tpa.event_registrations WHERE id=$1",[legacyRegistration])).rows[0].payment_status,"paid");
  pass("Additive migration preserves legacy speakers, paid registration evidence and disables existing-event reminders");
  const serverLog=await import("node:fs");
  const log=serverLog.openSync(dir+"/server.log","w");
  server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",new URL(base).port],{env,stdio:["ignore",log,log]});
  serverLog.closeSync(log);
  let ready=false;for(let n=0;n<60;n++){if(server.exitCode!==null)throw Error("Server exited");try{if((await fetch(base+"/api/health")).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready);
  async function request(path:string,body?:unknown,actor=0,status=200){const r=await fetch(base+path,{method:body?"POST":"GET",headers:{Cookie:"better-auth.session_token="+cookies[actor],Origin:base,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,`${path}: ${JSON.stringify(data)}`);return data;}
  async function unavailableEvent(id:string, title?:string) {
    const response=await fetch(base+"/events/"+id), html=await response.text();
    // Next's loading boundary streams 200 before notFound resolves. Verify the
    // actual unavailable UI and noindex boundary, not just the transport status.
    assert.ok([200,404].includes(response.status));
    assert.ok(html.includes("A little off the beaten path."));
    assert.match(html, /name="robots" content="noindex"/);
    if(title) assert.ok(!html.includes(title), "Unavailable event title must remain private");
  }
  async function event(overrides:Record<string,unknown>={}){
    let row=await request("/api/staff/events",{action:"save",version:0,title:"Event acceptance workshop",description:"A practical learning session for association members.",location:"TPA test hall",startsAt:new Date(Date.now()+3*86400000).toISOString(),endsAt:new Date(Date.now()+3*86400000+3600000).toISOString(),capacity:20,feePaise:0,...overrides});
    await unavailableEvent(row.id,row.title);
    row=await request("/api/staff/events",{action:"publish",id:row.id,version:row.version});return row;
  }
  async function row(id:string){return (await db.query("SELECT * FROM tpa.event_registrations WHERE id=$1",[id])).rows[0];}
  async function edit(e:Record<string,unknown>,change:Record<string,unknown>={}){return request("/api/staff/events",{action:"save",id:e.id,version:e.version,title:e.title,description:e.description,location:e.location,startsAt:e.starts_at,endsAt:e.ends_at,capacity:e.capacity,feePaise:e.fee_paise,visibility:e.visibility,deliveryMode:e.delivery_mode,speakers:e.speakers,reminders:e.reminders,...change});}
  async function payment(id:string,status:string,reference="BANK-TEST-001"){const r=await row(id);return request("/api/staff/registration-payments",{id,version:r.version,status,reference,note:"Synthetic bank reconciliation evidence"});}
  const speakers=Array.from({length:6},(_,i)=>({name:`Dr. Speaker ${i+1}`,credentials:"Professor of professional practice and community education"}));
  let privateEvent: {id:string};
  if(!browserOnly && !workerOnly) {
  await request("/api/staff/events",undefined,1,403);await request("/api/staff/events/delivery?eventId="+legacy,undefined,1,403);await request("/api/staff/registration-payments",undefined,1,403);
  let paid=await event({title:"Paid acceptance workshop",feePaise:75000,speakers});
  assert.equal(paid.reminders.enabled,true);
  const registration=await request("/api/member/events",{action:"register",eventId:paid.id},1);
  assert.equal(registration.payment_status,"pending");
  assert.equal((await request("/api/member/events",{action:"register",eventId:paid.id},1)).id,registration.id);
  assert.equal((await db.query("SELECT count(*)::int n FROM tpa.onboarding_mail WHERE registration_id=$1",[registration.id])).rows[0].n,1);
  let payload=openMail((await db.query("SELECT payload FROM tpa.onboarding_mail WHERE registration_id=$1",[registration.id])).rows[0].payload,env.BETTER_AUTH_SECRET);
  assert.ok(payload.text.includes("not a payment confirmation"));assert.ok(payload.text.includes("₹750.00"));assert.ok(payload.text.includes("IST"));assert.ok(payload.text.includes(registration.id));
  await request("/api/staff/registration-payments",{id:registration.id,version:registration.version,status:"paid",reference:"",note:"Checked bank"},0,400);
  await payment(registration.id,"failed");await payment(registration.id,"pending");await payment(registration.id,"paid");
  await request("/api/staff/registration-payments",{id:registration.id,version:registration.version,status:"paid",reference:"BANK-TEST-001",note:"Stale verification"},0,409);
  assert.equal((await row(registration.id)).payment_status,"paid");
  assert.equal((await db.query("SELECT count(*)::int n FROM tpa.event_payment_history WHERE registration_id=$1",[registration.id])).rows[0].n,3);
  await assert.rejects(edit(paid,{feePaise:10000}));
  await request("/api/staff/attendance",{registrationId:registration.id},0,409);
  paid=await edit(paid,{location:"Updated test hall"});
  assert.ok((await db.query("SELECT count(*)::int n FROM tpa.onboarding_mail WHERE event_id=$1 AND kind='event_update'",[paid.id])).rows[0].n>0);
  await request("/api/member/events",{action:"cancel",eventId:paid.id},1);
  const mailCount=(await db.query("SELECT count(*)::int n FROM tpa.onboarding_mail WHERE registration_id=$1",[registration.id])).rows[0].n;
  await request("/api/member/events",{action:"cancel",eventId:paid.id},1);
  assert.equal((await db.query("SELECT count(*)::int n FROM tpa.onboarding_mail WHERE registration_id=$1",[registration.id])).rows[0].n,mailCount);
  assert.equal((await row(registration.id)).payment_status,"paid");
  await request("/api/member/events",{action:"register",eventId:paid.id},1,409);await payment(registration.id,"refunded");
  assert.equal((await row(registration.id)).payment_status,"refunded");
  pass("Paid reservation, deduplication, failures, verification conflicts, update/cancellation emails and refund history");
  const free=await event({capacity:1,title:"Last-seat event"});
  const attempts=await Promise.all([1,2].map(actor=>fetch(base+"/api/member/events",{method:"POST",headers:{Cookie:"better-auth.session_token="+cookies[actor],Origin:base,"Content-Type":"application/json"},body:JSON.stringify({action:"register",eventId:free.id})})));
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
  privateEvent=await event({visibility:"members",title:"Members-only workshop",speakers:[speakers[0]]});
  await unavailableEvent(privateEvent.id,"Members-only workshop");
  await request("/api/member/events",{action:"register",eventId:privateEvent.id},2,403);await request("/api/member/events",{action:"register",eventId:privateEvent.id},1);
  const rebooking=await event({title:"Unpaid rebooking",feePaise:50000});
  const oldBooking=await request("/api/member/events",{action:"register",eventId:rebooking.id},1);
  await scheduleEventReminders(db,new Date(),env);
  await request("/api/member/events",{action:"cancel",eventId:rebooking.id},1);
  const newBooking=await request("/api/member/events",{action:"register",eventId:rebooking.id},1);
  assert.equal(newBooking.booking_revision,oldBooking.booking_revision+1);
  await scheduleEventReminders(db,new Date(),env);
  assert.equal((await db.query("SELECT count(*)::int n FROM tpa.event_reminders WHERE registration_id=$1 AND booking_revision=$2 AND status='scheduled'",[newBooking.id,newBooking.booking_revision])).rows[0].n,2);
  assert.equal((await db.query("SELECT count(*)::int n FROM tpa.event_reminders WHERE registration_id=$1 AND booking_revision=$2 AND reason='booking_changed'",[oldBooking.id,oldBooking.booking_revision])).rows[0].n,2);
  const futureWindow=await event({registrationStartsAt:new Date(Date.now()+86400000).toISOString()});await request("/api/member/events",{action:"register",eventId:futureWindow.id},1,409);
  const closedWindow=await event({registrationEndsAt:new Date(Date.now()-1000).toISOString()});await request("/api/member/events",{action:"register",eventId:closedWindow.id},1,409);
  pass("Draft privacy, role/membership restrictions, booking windows and simultaneous last-seat registration");

  const clock=new Date(),reminderEvent=await event({title:"Reminder clock workshop",startsAt:new Date(clock.getTime()+3600000).toISOString(),endsAt:new Date(clock.getTime()+7200000).toISOString(),feePaise:50000,reminders:{enabled:true,offsets:[60,15],includePending:true}});
  const pending=await request("/api/member/events",{action:"register",eventId:reminderEvent.id},1);
  const confirmed=await request("/api/member/events",{action:"register",eventId:reminderEvent.id},3);await payment(confirmed.id,"paid");
  await Promise.all([scheduleEventReminders(db,clock,env),scheduleEventReminders(db,clock,env)]);
  const reminders=(await db.query("SELECT * FROM tpa.event_reminders WHERE event_id=$1 ORDER BY registration_id,offset_minutes,audience",[reminderEvent.id])).rows;
  assert.equal(reminders.length,8);assert.equal(reminders.filter(r=>r.status==="queued").length,2);
  assert.equal(reminders.filter(r=>r.status==="skipped" && r.reason==="payment_changed").length,2);
  const pendingReminder=reminders.find(r=>r.registration_id===pending.id && r.status==="queued");
  payload=openMail((await db.query("SELECT payload FROM tpa.onboarding_mail WHERE id=$1",[pendingReminder.mail_id])).rows[0].payload,env.BETTER_AUTH_SECRET);assert.ok(payload.text.includes("not a registration confirmation"));
  await payment(pending.id,"paid");let sends=0;
  await deliverEventReminder(db,pendingReminder.mail_id,async()=>{sends++;},clock);assert.equal(sends,0);
  assert.equal((await db.query("SELECT reason FROM tpa.onboarding_mail WHERE id=$1",[pendingReminder.mail_id])).rows[0].reason,"payment_changed");
  const confirmedReminder=reminders.find(r=>r.registration_id===confirmed.id && r.status==="queued");
  await deliverEventReminder(db,confirmedReminder.mail_id,async(c)=>{sends++;await c.query("UPDATE tpa.onboarding_mail SET status='accepted',provider_id=$2 WHERE id=$1",[confirmedReminder.mail_id,"mock-confirmed"]);},clock);
  assert.equal(sends,1);
  await deliverEventReminder(db,confirmedReminder.mail_id,async()=>{sends++;},clock);assert.equal(sends,1);
  await scheduleEventReminders(db,new Date(clock.getTime()+45*60000),env);
  assert.equal((await db.query("SELECT count(*)::int n FROM tpa.event_reminders WHERE event_id=$1 AND offset_minutes=15 AND status='queued'",[reminderEvent.id])).rows[0].n,2);
  const newer=await edit(reminderEvent,{startsAt:new Date(clock.getTime()+7200000).toISOString(),endsAt:new Date(clock.getTime()+10800000).toISOString()});
  await scheduleEventReminders(db,new Date(clock.getTime()+45*60000),env);
  assert.ok((await db.query("SELECT count(*)::int n FROM tpa.event_reminders WHERE event_id=$1 AND reason='schedule_changed'",[newer.id])).rows[0].n>=2);
  await request("/api/staff/events",{action:"cancel",id:newer.id,version:newer.version});await scheduleEventReminders(db,new Date(clock.getTime()+45*60000),env);
  assert.equal((await db.query("SELECT count(*)::int n FROM tpa.event_reminders WHERE event_id=$1 AND status='scheduled'",[newer.id])).rows[0].n,0);
  const expiry=await event({title:"Catch-up clock",startsAt:new Date(clock.getTime()+3600000).toISOString(),endsAt:new Date(clock.getTime()+7200000).toISOString(),reminders:{enabled:true,offsets:[60],includePending:false}});
  const late=await request("/api/member/events",{action:"register",eventId:expiry.id},1);
  await scheduleEventReminders(db,new Date(clock.getTime()+15*60000),env);
  assert.equal((await db.query("SELECT status FROM tpa.event_reminders WHERE registration_id=$1",[late.id])).rows[0].status,"queued");
  await scheduleEventReminders(db,new Date(clock.getTime()+15*60000+1),env);
  assert.equal((await db.query("SELECT reason FROM tpa.event_reminders WHERE registration_id=$1",[late.id])).rows[0].reason,"reminder_expired");
  await scheduleEventReminders(db,new Date(clock.getTime()+3600000),env);
  let configurable=await event({title:"Reminder settings change",startsAt:new Date(clock.getTime()+3600000).toISOString(),endsAt:new Date(clock.getTime()+7200000).toISOString(),reminders:{enabled:true,offsets:[60],includePending:false}});
  const configuredReg=await request("/api/member/events",{action:"register",eventId:configurable.id},3);await scheduleEventReminders(db,clock,env);
  configurable=await edit(configurable,{reminders:{enabled:false,offsets:[60],includePending:false}});await scheduleEventReminders(db,clock,env);
  assert.equal((await db.query("SELECT reason FROM tpa.event_reminders WHERE registration_id=$1",[configuredReg.id])).rows[0].reason,"schedule_changed");
  const startedGuard=await event({title:"Never remind after start",startsAt:new Date(clock.getTime()+3600000).toISOString(),endsAt:new Date(clock.getTime()+7200000).toISOString(),reminders:{enabled:true,offsets:[60],includePending:false}});
  const guardReg=await request("/api/member/events",{action:"register",eventId:startedGuard.id},3);await scheduleEventReminders(db,clock,env);
  const guardMail=(await db.query("SELECT mail_id FROM tpa.event_reminders WHERE registration_id=$1",[guardReg.id])).rows[0].mail_id;
  await deliverEventReminder(db,guardMail,async()=>{throw Error("Reminder sent after start");},new Date(clock.getTime()+3600000));
  assert.equal((await db.query("SELECT reason FROM tpa.onboarding_mail WHERE id=$1",[guardMail])).rows[0].reason,"event_started");
  const lateEvent=await event({title:"Late registration reminder",startsAt:new Date(clock.getTime()+3600000).toISOString(),endsAt:new Date(clock.getTime()+7200000).toISOString(),reminders:{enabled:true,offsets:[60],includePending:false}});
  const lateReg=await request("/api/member/events",{action:"register",eventId:lateEvent.id},3);await scheduleEventReminders(db,new Date(clock.getTime()+16*60000),env);
  assert.equal((await db.query("SELECT reason FROM tpa.event_reminders WHERE registration_id=$1",[lateReg.id])).rows[0].reason,"reminder_expired");
  const allOffsets=await event({title:"Three configured reminder times",startsAt:new Date(clock.getTime()+10080*60000).toISOString(),endsAt:new Date(clock.getTime()+10080*60000+3600000).toISOString(),reminders:{enabled:true,offsets:[10080,1440,15],includePending:false}});
  const allReg=await request("/api/member/events",{action:"register",eventId:allOffsets.id},3);
  for(const offset of [10080,1440,15]) {await scheduleEventReminders(db,new Date(clock.getTime()+(10080-offset)*60000),env);assert.equal((await db.query("SELECT status FROM tpa.event_reminders WHERE registration_id=$1 AND offset_minutes=$2",[allReg.id,offset])).rows[0].status,"queued");}
  pass("Controlled-clock reminders, concurrent scheduling, audience changes, rescheduling, cancellation, disabled settings, late registration, three offsets and exact catch-up expiry");

  // Transport is mocked, including quota and retries. No real credentials or recipients are used.
  await db.query("UPDATE tpa.onboarding_mail SET status='failed',reason='test_drained' WHERE status IN ('queued','leased')");
  const transportEvent=await event({title:"Delivery test workshop",startsAt:new Date(Date.now()+3600000-1000).toISOString(),endsAt:new Date(Date.now()+7200000).toISOString(),reminders:{enabled:true,offsets:[60],includePending:false}});
  const transportRegistration=await request("/api/member/events",{action:"register",eventId:transportEvent.id},1);
  await db.query("UPDATE tpa.onboarding_mail SET status='accepted',provider_id='mock-reservation' WHERE registration_id=$1",[transportRegistration.id]);
  await scheduleEventReminders(db,new Date(),env);
  const transportMail=(await db.query("SELECT * FROM tpa.onboarding_mail WHERE registration_id=$1 AND kind='event_reminder'",[transportRegistration.id])).rows[0];assert.ok(transportMail);
  const quota={daily:{limit:1000,used:0,resets_at:new Date(Date.now()+86400000).toISOString()},monthly:{limit:10000,used:0,resets_at:new Date(Date.now()+86400000).toISOString()}};
  let transportCalls=0;
  const mockEnv={...env,TPA_MAIL_SINK:"false",RESEND_DOMAIN_VERIFIED:"true",RESEND_API_KEY:"synthetic",RESEND_RECEIVING_API_KEY:"synthetic"};
  const deps={quota:async()=>quota,request:async()=>{transportCalls++;return {id:"mock-event-delivery"};}};
  await runOnboardingTick(db,{...mockEnv,EVENT_REMINDERS_ENABLED:"false"},deps);assert.equal(transportCalls,0);
  await runOnboardingTick(db,mockEnv,{...deps,quota:async()=>({...quota,daily:{...quota.daily,used:1000}})});assert.equal(transportCalls,0);
  await runOnboardingTick(db,mockEnv,{...deps,request:async()=>{throw new EmailProviderError(true,false,"test_transient");}});
  assert.equal((await db.query("SELECT status FROM tpa.onboarding_mail WHERE id=$1",[transportMail.id])).rows[0].status,"queued");
  await db.query("UPDATE tpa.onboarding_mail SET available_at=now()-interval '1 minute',status='leased',lease_until=now()-interval '1 second' WHERE id=$1",[transportMail.id]);
  await runOnboardingTick(db,mockEnv,deps);assert.equal(transportCalls,1);
  async function webhook(type:string,id:string,forged=false) {
    const timestamp=new Date(),body=JSON.stringify({type,created_at:timestamp.toISOString(),data:{email_id:"mock-event-delivery",from:"no-reply@updates.tpassociation.org",to:["event2@example.invalid"]}});
    const signature=new Webhook(env.RESEND_WEBHOOK_SECRET).sign(id,timestamp,body);
    const r=await fetch(base+"/api/webhooks/resend",{method:"POST",headers:{"Content-Type":"application/json","svix-id":id,"svix-timestamp":String(Math.floor(timestamp.getTime()/1000)),"svix-signature":forged?"forged":signature},body});assert.equal(r.status,forged?400:200);
  }
  await webhook("email.delivered","synthetic-forged",true);await webhook("email.delivered","synthetic-delivered");await webhook("email.delivered","synthetic-delivered");
  assert.equal((await db.query("SELECT status FROM tpa.onboarding_mail WHERE id=$1",[transportMail.id])).rows[0].status,"delivered");
  await webhook("email.bounced","synthetic-bounced");await webhook("email.delivered","synthetic-old-delivered");
  assert.equal((await db.query("SELECT status FROM tpa.onboarding_mail WHERE id=$1",[transportMail.id])).rows[0].status,"bounced");
  await db.query("INSERT INTO tpa.email_suppressions(email,reason) VALUES('event2@example.invalid','suppressed')");
  const suppressed=await event({title:"Suppressed registration email"});const suppressedReg=await request("/api/member/events",{action:"register",eventId:suppressed.id},1);
  await runOnboardingTick(db,env,deps);assert.equal(transportCalls,1);
  assert.equal((await db.query("SELECT reason FROM tpa.onboarding_mail WHERE registration_id=$1",[suppressedReg.id])).rows[0].reason,"suppressed");
  await db.query("DELETE FROM tpa.email_suppressions WHERE email='event2@example.invalid'");
  pass("Quota pause, transient retry, expired-lease restart recovery, delivery/bounce projection, signed delivery events, forged-signature rejection and suppression");

  } else { privateEvent=await event({visibility:"members",title:"Members-only workshop",speakers:[speakers[0]]}); }
  if(!browserOnly) {
    await db.query("UPDATE tpa.onboarding_mail SET status='failed',reason='test_drained' WHERE status IN ('queued','leased')");
    const workerEvent=await event({title:"Actual worker restart acceptance",startsAt:new Date(Date.now()+3600000-1000).toISOString(),endsAt:new Date(Date.now()+7200000).toISOString(),reminders:{enabled:true,offsets:[60],includePending:false}});
    const workerReg=await request("/api/member/events",{action:"register",eventId:workerEvent.id},3);
    async function startWorker(enabled:boolean) {const w=spawn(process.execPath,[".next/email-worker.mjs"],{env:{...env,EVENT_REMINDERS_ENABLED:String(enabled)},stdio:"ignore"});workerProcesses.push(w);return w;}
    async function stopWorker(w:ReturnType<typeof spawn>){if(w.exitCode!==null || w.signalCode!==null)return;await new Promise<void>(resolve=>{w.once("exit",()=>resolve());w.kill();});}
    async function waitWorker(label:string,predicate:()=>Promise<boolean>,w:ReturnType<typeof spawn>) {const end=Date.now()+60000;while(Date.now()<end){assert.equal(w.exitCode,null,"Worker exited: "+label);if(await predicate())return;await new Promise(r=>setTimeout(r,500));}throw Error("Worker timeout: "+label);}
    const paused=await startWorker(false);
    await waitWorker("paused worker still confirms registration",async()=>(await db.query("SELECT status FROM tpa.onboarding_mail WHERE registration_id=$1",[workerReg.id])).rows[0].status==="accepted",paused);
    assert.equal((await db.query("SELECT count(*)::int n FROM tpa.event_reminders WHERE registration_id=$1",[workerReg.id])).rows[0].n,0);await stopWorker(paused);
    const enabled=await startWorker(true);
    await waitWorker("reminder delivered to sink",async()=>(await db.query("SELECT count(*)::int n FROM tpa.onboarding_mail WHERE registration_id=$1 AND kind='event_reminder' AND status='accepted'",[workerReg.id])).rows[0].n===1,enabled);
    const beat=(await db.query("SELECT heartbeat_at FROM tpa.email_worker_state WHERE id='email'")).rows[0].heartbeat_at;await stopWorker(enabled);
    const restarted=await startWorker(true);
    await waitWorker("restarted heartbeat",async()=>new Date((await db.query("SELECT heartbeat_at FROM tpa.email_worker_state WHERE id='email'")).rows[0].heartbeat_at)>beat,restarted);await stopWorker(restarted);
    assert.equal((await db.query("SELECT count(*)::int n FROM tpa.onboarding_mail WHERE registration_id=$1 AND kind='event_reminder'",[workerReg.id])).rows[0].n,1);
    pass("Bundled worker pause preserves confirmation, enabling schedules/sends reminders, and actual restart prevents duplicates");
  }
  if(!workerOnly) {
  const instructions={label:"Synthetic event payments",payee:"TPA TEST PAYEE",upiId:"synthetic-test@upi",phone:"",qrId:null};
  await db.query("INSERT INTO tpa.payment_details(id,status,draft,active_snapshot) VALUES($1,'active',$2,$2)",[randomUUID(),instructions]);
  let browserEvent=await event({title:"Community learning workshop",feePaise:75000,speakers,location:"Tollygunge association auditorium"});
  browser=await chromium.launch({channel:process.env.TPA_BROWSER_CHANNEL || undefined});
  for(const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844}]){
    const label=viewport.width===1440?"desktop":viewport.width===768?"tablet":"phone";
    const staffContext=await browser.newContext({viewport}),memberContext=await browser.newContext({viewport});
    await staffContext.addCookies([{name:"better-auth.session_token",value:cookies[0],url:base}]);
    await memberContext.addCookies([{name:"better-auth.session_token",value:cookies[4],url:base}]);
    const staff=await staffContext.newPage(),member=await memberContext.newPage(),publicPage=await browser.newPage({viewport});
    for(const p of [staff,member,publicPage])p.on("pageerror",e=>evidence.browserErrors.push(`${label}: ${e.message}`));
    async function screenshot(p:typeof staff,name:string){await p.screenshot({path:`${dir}/${label}-${name}.png`,fullPage:true});evidence.screenshots.push(`${label}-${name}.png`);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label} ${name} overflows`);}
    if(label==="desktop") {
      await publicPage.goto(base+"/events/"+browserEvent.id);
      await publicPage.getByRole("link",{name:"Sign in to register",exact:false}).click();await check(publicPage).toHaveURL(new RegExp("/login\\?returnTo="));
      assert.equal(new URL(publicPage.url()).searchParams.get("returnTo"),`/member/events?eventId=${browserEvent.id}`);
      await check(publicPage.getByRole("link",{name:"Create an account",exact:true})).toHaveAttribute("href","/signup?returnTo="+encodeURIComponent(`/member/events?eventId=${browserEvent.id}`));
      await publicPage.getByLabel("Email",{exact:true}).fill("event5@example.invalid");await publicPage.getByLabel("Password",{exact:true}).fill(syntheticPassword);
      await publicPage.getByRole("button",{name:"Sign in",exact:true}).click();await check(publicPage).toHaveURL(base+"/member/events?eventId="+browserEvent.id);
      await check(publicPage.locator("article").first()).toContainText(browserEvent.title);
      const signupContext=await browser.newContext({viewport});const signup=await signupContext.newPage();
      await signup.goto(base+"/signup?returnTo="+encodeURIComponent(`/member/events?eventId=${browserEvent.id}`));
      await signup.getByLabel("Full name").fill("Synthetic event signup");await signup.getByLabel("Email",{exact:true}).fill("event-signup@example.invalid");await signup.getByLabel("Password",{exact:true}).fill(syntheticPassword);
      await signup.getByRole("button",{name:"Create account",exact:true}).click();await check(signup).toHaveURL(base+"/member/events?eventId="+browserEvent.id);
      await check(signup.locator("article").first()).toContainText(browserEvent.title);await signupContext.close();
      pass("Anonymous event link and real password sign-in and signup preserve the selected event");
    }
    await staff.goto(base+"/admin/workspaces/events?id="+browserEvent.id);await check(staff.getByLabel("Title",{exact:true})).toHaveValue(browserEvent.title);
    await check(staff.getByText("Pre-event reminders",{exact:true})).toBeVisible();
    if(label==="desktop") {
      await staff.getByRole("button",{name:"New event",exact:true}).click();
      await staff.getByLabel("Title",{exact:true}).fill("Created through event editor");
      await staff.getByLabel("Venue / joining instructions").fill("Synthetic browser hall");
      await staff.getByLabel("Starts (IST)").fill(istInput(new Date(Date.now()+5*86400000).toISOString()));
      await staff.getByLabel("Ends (IST)").fill(istInput(new Date(Date.now()+5*86400000+3600000).toISOString()));
      await staff.getByRole("button",{name:"Add speaker",exact:true}).click();await staff.getByLabel("Name",{exact:true}).fill("Dr. Browser Speaker");
      await staff.getByRole("button",{name:"Save draft",exact:true}).click();await check(staff.getByRole("status")).toContainText("Event draft saved");
      await staff.getByRole("button",{name:"Publish saved event",exact:true}).click();await check(staff.getByRole("status")).toContainText("Published");
      const created=(await request("/api/staff/events")).find((e:{title:string})=>e.title==="Created through event editor");assert.equal(created.status,"published");assert.equal(created.speakers.length,1);
      await staff.goto(base+"/admin/workspaces/events?id="+browserEvent.id);await check(staff.getByLabel("Title",{exact:true})).toHaveValue(browserEvent.title);
      await staff.getByRole("button",{name:"Move speaker 6 up",exact:true}).click();
      await check(staff.getByLabel("Name",{exact:true}).nth(4)).toHaveValue("Dr. Speaker 6");
      await staff.getByRole("button",{name:"Move speaker 5 down",exact:true}).click();
      await staff.getByLabel("Reminder 1 (minutes)").fill("2880");
      await staff.getByRole("button",{name:"Save changes & notify registrants"}).click();
      await check(staff.getByRole("status")).toContainText("Event changes saved");
      browserEvent=(await request("/api/staff/events?id="+browserEvent.id))[0];
      assert.equal(browserEvent.reminders.offsets[0],2880);
      await staff.getByLabel("Title",{exact:true}).focus();await staff.keyboard.press("Tab");await check(staff.getByRole("group",{name:"Event details",exact:true}).getByLabel("Description")).toBeFocused();
    }
    await screenshot(staff,"event-editor");
    await publicPage.goto(base+"/events/"+browserEvent.id);await check(publicPage.getByRole("heading",{name:"Speakers",exact:true})).toBeVisible();await screenshot(publicPage,"public-event");
    await member.goto(base+"/member/events?eventId="+browserEvent.id);
    const card=member.locator("article").filter({has:member.getByRole("heading",{name:browserEvent.title,exact:true})});
    if(label==="desktop") {await card.getByRole("button",{name:"Reserve place"}).click();await check(card.getByText(/^Payment pending/)).toBeVisible();}
    await check(card.getByText("TPA TEST PAYEE",{exact:false})).toBeVisible();await screenshot(member,"pending-payment");
    await staff.goto(base+"/admin/workspaces/payments");await check(staff.getByRole("heading",{name:"Registration payments",exact:true})).toBeVisible();await screenshot(staff,"payments");
    await staffContext.close();await memberContext.close();await publicPage.close();
    pass(`${label} event editor, public speakers, reservation/payment instructions and staff payment UI`);
  }
  const browserReg=(await db.query("SELECT * FROM tpa.event_registrations WHERE event_id=$1 AND user_id=$2",[browserEvent.id,users[4]])).rows[0];
  const payContext=await browser.newContext({viewport:{width:1440,height:1000}});await payContext.addCookies([{name:"better-auth.session_token",value:cookies[0],url:base}]);const payPage=await payContext.newPage();
  await payPage.goto(base+"/admin/workspaces/payments");const paymentRow=payPage.locator("tr").filter({hasText:browserEvent.title});await paymentRow.getByRole("button",{name:"Review payment"}).click();
  await payPage.getByLabel("Bank / payment reference").fill("BROWSER-BANK-001");await payPage.getByLabel("Verification note").fill("Verified synthetic credit of INR 750");payPage.once("dialog",d=>d.accept());await payPage.getByRole("button",{name:"Confirm status change"}).click();await check(payPage.locator(".registration-payments").getByRole("status")).toContainText("Payment status saved");
  assert.equal((await row(browserReg.id)).payment_status,"paid");await payContext.close();
  const statusMail=(await db.query("SELECT * FROM tpa.onboarding_mail WHERE registration_id=$1 AND kind='event_status' ORDER BY created_at",[browserReg.id])).rows;
  assert.equal(statusMail.length,2);assert.ok(openMail(statusMail[0].payload,env.BETTER_AUTH_SECRET).text.includes("not a payment confirmation"));assert.ok(openMail(statusMail[1].payload,env.BETTER_AUTH_SECRET).text.includes("registration is confirmed"));
  for(let tick=0;tick<12;tick++) {const count=(await db.query("SELECT count(*)::int n FROM tpa.onboarding_mail WHERE registration_id=$1 AND status='queued'",[browserReg.id])).rows[0].n;if(!count)break;await runOnboardingTick(db,env);}
  const sentStatus=(await db.query("SELECT status,provider_id FROM tpa.onboarding_mail WHERE registration_id=$1 AND kind='event_status'",[browserReg.id])).rows;
  assert.ok(sentStatus.every(m=>m.status==="accepted" && m.provider_id.startsWith("sink-")));
  pass("Staff browser payment verification and reservation/confirmation delivery through the isolated mail sink");
  const flyerContext=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await flyerContext.addCookies([{name:"better-auth.session_token",value:cookies[0],url:base}]);const flyer=await flyerContext.newPage();
  for(const count of [1,2,3,6]) {
    const current=(await request("/api/staff/flyers?id="+browserEvent.id))[0];
    const chosen=speakers.slice(0,count);if(count===6)chosen[5]={name:("Dr. "+"Longspeakername".repeat(4)).slice(0,60),credentials:"A".repeat(120)};
    await request("/api/staff/flyers",{eventId:browserEvent.id,version:current.template_version,speakers:chosen});
    await flyer.goto(base+"/admin/workspaces/flyers?id="+browserEvent.id);await check(flyer.getByRole("button",{name:"Generate preview"})).toBeEnabled();await flyer.getByRole("button",{name:"Generate preview"}).click();await check(flyer.getByRole("status")).toContainText("Preview generated");
    const image=await flyer.locator("img.flyer-preview").getAttribute("src");assert.ok(image?.startsWith("data:image/png;base64,"));
    const bytes=Buffer.from(image!.split(",")[1],"base64"),png=PNG.sync.read(bytes);assert.equal(png.width,1080);assert.equal(png.height,1350);
    assert.equal(jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data,eventLink(base,browserEvent));
    const pngName=`flyer-${count}-speakers.png`;await writeFile(dir+"/"+pngName,bytes);evidence.exports.push(pngName);
    const download=flyer.waitForEvent("download");await flyer.getByRole("button",{name:"Download PDF"}).click();const pdf=await download;const pdfName=`flyer-${count}-speakers.pdf`;await pdf.saveAs(dir+"/"+pdfName);assert.ok((await readFile(dir+"/"+pdfName)).subarray(0,5).toString()==="%PDF-");evidence.exports.push(pdfName);
  }
  for(const width of [768,390]) {await flyer.setViewportSize({width,height:900});await flyer.screenshot({path:`${dir}/flyer-builder-${width}.png`,fullPage:true});evidence.screenshots.push(`flyer-builder-${width}.png`);assert.ok(await flyer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  const privateFlyer=(await request("/api/staff/flyers?id="+privateEvent.id))[0];assert.equal(eventLink(base,privateFlyer),`${base}/member/events?eventId=${privateEvent.id}`);
  await flyer.goto(base+"/admin/workspaces/flyers?id="+privateEvent.id);await flyer.getByRole("button",{name:"Generate preview"}).click();await check(flyer.getByRole("status")).toContainText("Preview generated");
  const privateImage=await flyer.locator("img.flyer-preview").getAttribute("src"),privatePng=PNG.sync.read(Buffer.from(privateImage!.split(",")[1],"base64"));assert.equal(jsQR(new Uint8ClampedArray(privatePng.data),privatePng.width,privatePng.height)?.data,eventLink(base,privateFlyer));await flyerContext.close();
  pass("One/two/three/six-speaker PNG and PDF exports, long supported text, responsive flyer UI and public/member-only QR destinations");
  await db.query("UPDATE tpa.events SET starts_at=now()-interval '1 minute',registration_ends_at=NULL WHERE id=$1",[browserEvent.id]);
  await request("/api/staff/attendance",{registrationId:browserReg.id});assert.equal((await request("/api/staff/attendance",{registrationId:browserReg.id})).duplicate,true);
  for(const width of [1440,768,390]){const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies([{name:"better-auth.session_token",value:cookies[4],url:base}]);const p=await context.newPage();await p.goto(base+"/member/events?eventId="+browserEvent.id);const card=p.locator("article").filter({has:p.getByRole("heading",{name:browserEvent.title,exact:true})});await check(card).toContainText("Registration confirmed");await check(card).toContainText("Attendance recorded");await p.screenshot({path:`${dir}/confirmed-attendance-${width}.png`,fullPage:true});evidence.screenshots.push(`confirmed-attendance-${width}.png`);await context.close();}
  pass("Confirmed member state, started-event attendance, duplicate check-in and desktop/tablet/phone attendance display");
  }
  if(process.argv.includes('--payment-table')){const qa=await verifyPaymentTable(browser!,base,cookies[0],db,dir);await writeFile(dir+'/payment-table.json',JSON.stringify(qa,null,2));pass('Payment table readable at 320/390/768 in both themes, keyboard scrolling, empty state and cancelled confirmation focus');}
  assert.deepEqual(evidence.browserErrors,[]);
  evidence.passed=true;evidence.completed=new Date().toISOString();await save();console.log("Evidence: "+dir);
} catch(e){await save();throw e;}
finally {for(const w of workerProcesses)if(w.exitCode===null && w.signalCode===null){const ended=new Promise(r=>w.once("exit",r));w.kill();await ended;}await browser?.close();server?.kill();if(server && server.exitCode===null)await new Promise(r=>server!.once("exit",r));await db.end();if(created)await root.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);await root.end();}
