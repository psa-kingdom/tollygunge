import { randomUUID, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { campaignEligibility, emailTransaction } from './email-service';
import { tokenHash, emailAddress } from '../domain/email';
import { sealMail } from './onboarding-mail';
import { eventLink, eventTime } from '../domain/event-flow';
import { promotionKinds, type PromotionKind, type PromotionSettings } from '../domain/event-engagement';
type Event = {id:string;version:number;status:string;title:string;visibility:string;starts_at:string|Date;registration_starts_at:string|Date|null;registration_ends_at:string|Date|null;capacity:number;location:string;fee_paise:number;created_at:string|Date;booking_closed?:boolean;completed_at?:string|null;archived_at?:string|null};
export function promotionWindow(e:Event,s:PromotionSettings,kind:PromotionKind,registrations:number,now:Date,configuredAt:Date) {
 const start=new Date(e.starts_at),close=e.registration_ends_at?new Date(e.registration_ends_at):start,open=e.registration_starts_at?new Date(e.registration_starts_at):configuredAt;
 if(!s[kind]||e.status!=='published'||e.booking_closed||e.completed_at||e.archived_at||now<open||now>=close||now>=start||registrations>=e.capacity) return null;
 let due=kind==='registration_open'?open:kind==='final_reminder'?new Date(close.getTime()-s.finalMinutes*60000):kind==='upcoming'?new Date(start.getTime()-s.upcomingMinutes*60000):now;
 if(kind==='capacity_pressure' && registrations/e.capacity*100<s.capacityPercent) return null;
 if(due<open) due=open;
 if(now<due || (kind!=='capacity_pressure'&&now.getTime()>due.getTime()+15*60000)) return null;
 return {due,expires:new Date(Math.min(close.getTime(),start.getTime(),due.getTime()+15*60000))};
}
export async function promotionRecipients(c:PoolClient,eventId:string,userId:string|null=null) {
 return (await c.query(`SELECT u.id,u.name,u.email FROM public."user" u LEFT JOIN tpa.member_profiles p ON p.user_id=u.id LEFT JOIN tpa.newsletter_consents n ON n.user_id=u.id LEFT JOIN tpa.email_suppressions s ON s.email=lower(u.email) WHERE ${campaignEligibility} AND ($2::text IS NULL OR u.id=$2) AND EXISTS(SELECT 1 FROM tpa.people pe JOIN tpa.memberships m ON m.person_id=pe.id WHERE pe.user_id=u.id AND m.status='active' AND (m.valid_from IS NULL OR m.valid_from<=current_date) AND (m.valid_until IS NULL OR m.valid_until>=current_date)) AND NOT EXISTS(SELECT 1 FROM tpa.event_registrations r WHERE r.event_id=$1 AND r.user_id=u.id AND r.status='registered') ORDER BY u.id LIMIT 10001`,[eventId,userId])).rows as {id:string;name:string;email:string}[];
}
const labels:Record<PromotionKind,string>={registration_open:'Registration is now open',capacity_pressure:'Seats are filling',final_reminder:'Last day — register now',upcoming:'Event is coming soon'};
export function promotionMessage(e:Event,kind:PromotionKind,origin:string) {
 return {subject:`${labels[kind]} — ${e.title}`.replace(/[\r\n]/g,' ').slice(0,500),body:`${labels[kind]}\n\n${e.title}\n${eventTime(e.starts_at)}\n${e.location}\n${e.fee_paise?`Fee ₹${(e.fee_paise/100).toFixed(2)} · manual verification`:'Free registration'}\n\n${eventLink(origin,e)}`};
}
type Review={eventId:string;eventVersion:number;settingsVersion:number;actor:string;digest:string;expires:number};
export function promotionReview(recipients:{id:string;email:string}[],context:Omit<Review,'digest'|'expires'>,secret=process.env.BETTER_AUTH_SECRET!) {
 const proof={...context,digest:tokenHash(JSON.stringify(recipients.map(p=>[p.id,p.email]))),expires:Date.now()+10*60000};
 const body=Buffer.from(JSON.stringify(proof)).toString('base64url');return body+'.'+createHmac('sha256',secret).update('tpa-event-promotion\0'+body).digest('base64url');
}
export function verifyPromotionReview(token:unknown,recipients:{id:string;email:string}[],context:Omit<Review,'digest'|'expires'>,secret=process.env.BETTER_AUTH_SECRET!) {
 try {
  if(typeof token!=='string'||token.length>2000)throw Error();const [body,sig,...rest]=token.split('.');if(rest.length)throw Error();
  const expected=createHmac('sha256',secret).update('tpa-event-promotion\0'+body).digest(),actual=Buffer.from(sig,'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error();
  const proof:Review=JSON.parse(Buffer.from(body,'base64url').toString());
  if(proof.expires<Date.now()||!Number.isFinite(proof.expires)||proof.digest!==tokenHash(JSON.stringify(recipients.map(p=>[p.id,p.email])))||Object.entries(context).some(([k,v])=>proof[k as keyof Review]!==v))throw Error();
 }catch{throw Error('Audience or event changed. Review the saved promotion again.');}
}
export async function scheduleEventPromotions(pool:Pool,now=new Date(),env=process.env) {
 if(env.EVENT_PROMOTIONS_ENABLED!=='true') return;
 await emailTransaction(pool,async c=>{
  // Serialized schedules avoid duplicate dispatches even when multiple workers tick.
  await c.query('SELECT pg_advisory_xact_lock(74672031)');
  const settings=(await c.query('SELECT * FROM tpa.event_promotion_settings ORDER BY event_id')).rows;
  for(const setting of settings) {
   const e=(await c.query('SELECT * FROM tpa.events WHERE id=$1 FOR SHARE',[setting.event_id])).rows[0];
   if(setting.approved_version!==setting.version||setting.approved_event_version!==e.version)continue;
   const count=(await c.query("SELECT count(*)::int n FROM tpa.event_registrations WHERE event_id=$1 AND status='registered'",[e.id])).rows[0].n;
   for(const kind of promotionKinds) {
    const window=promotionWindow(e,setting.settings,kind,count,now,new Date(setting.approved_at));if(!window) continue;
    // One accepted/scheduled lifecycle message per kind. Obsolete unsent jobs permit replacement.
    const prior=(await c.query(`SELECT p.id FROM tpa.event_promotions p WHERE p.event_id=$1 AND p.kind=$2 AND (p.event_version=$3 AND p.settings_version=$4 OR EXISTS(SELECT 1 FROM tpa.email_jobs j WHERE j.dispatch_id=p.dispatch_id AND j.status IN ('accepted','review')) OR EXISTS(SELECT 1 FROM tpa.email_jobs j WHERE j.dispatch_id=p.dispatch_id AND j.status IN ('queued','leased') AND p.event_version=$3 AND p.settings_version=$4))`,[e.id,kind,e.version,setting.version])).rowCount;
    if(prior) continue;
    const recipients=await promotionRecipients(c,e.id);if(!recipients.length||recipients.length>10000) continue;
    const dispatch=randomUUID(),{subject,body}=promotionMessage(e,kind,env.BETTER_AUTH_URL!);
    await c.query('INSERT INTO tpa.email_dispatches(id,campaign_id,campaign_version,snapshot,created_by) VALUES($1,NULL,$2,$3,$4)',[dispatch,setting.version,{name:subject,subject,body,audience:{eventId:e.id},eventPromotion:true},setting.updated_by]);
    await c.query('INSERT INTO tpa.event_promotions(event_id,kind,event_version,settings_version,due_at,expires_at,dispatch_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[e.id,kind,e.version,setting.version,window.due,window.expires,dispatch]);
    for(const person of recipients) {
     const token=randomBytes(32).toString('base64url');
     await c.query('INSERT INTO tpa.email_unsubscribe_tokens(token_hash,user_id) VALUES($1,$2)',[tokenHash(token),person.id]);
     await c.query("INSERT INTO tpa.email_jobs(id,kind,dispatch_id,user_id,recipient,payload,created_by) VALUES($1,'campaign',$2,$3,$4,$5,$6)",[randomUUID(),dispatch,person.id,emailAddress(person.email),{subject,body,eventPromotion:true,unsubscribe:sealMail(`${env.BETTER_AUTH_URL}/unsubscribe#token=${token}`,env.BETTER_AUTH_SECRET)},setting.updated_by]);
    }
   }
  }
 });
}
export async function promotionJobEligibility(pool:Pool,dispatchId:string,userId:string,now=new Date()) {
 return emailTransaction(pool,async c=>{
  const promotion=(await c.query('SELECT * FROM tpa.event_promotions WHERE dispatch_id=$1',[dispatchId])).rows[0];if(!promotion) return false;
  const e=(await c.query('SELECT * FROM tpa.events WHERE id=$1',[promotion.event_id])).rows[0];
  const s=(await c.query('SELECT * FROM tpa.event_promotion_settings WHERE event_id=$1',[promotion.event_id])).rows[0];
  if(!e||!s||e.version!==promotion.event_version||s.version!==promotion.settings_version||s.approved_version!==s.version||s.approved_event_version!==e.version||now>=new Date(promotion.expires_at)||now<new Date(promotion.due_at)) return false;
  const count=(await c.query("SELECT count(*)::int n FROM tpa.event_registrations WHERE event_id=$1 AND status='registered'",[e.id])).rows[0].n;
  if(!promotionWindow(e,s.settings,promotion.kind,count,now,new Date(s.approved_at))) return false;
  return !!(await promotionRecipients(c,e.id,userId)).length;
 });
}
