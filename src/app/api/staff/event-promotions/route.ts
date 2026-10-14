import { authorized, operation, jsonBody, transaction, audit, OperationError } from '@/lib/operation-api';
import { record, uuid, version } from '@/domain/operations';
import { defaultPromotion, promotionInput, promotionKinds } from '@/domain/event-engagement';
import { promotionRecipients,promotionReview,verifyPromotionReview,promotionMessage } from '@/lib/event-promotion';
export const runtime='nodejs';
export async function GET(request:Request) {return operation(async()=>{
 await authorized(request,'events:manage');const eventId=uuid(new URL(request.url).searchParams.get('eventId'));
 return transaction(async c=>({...(await c.query('SELECT * FROM tpa.event_promotion_settings WHERE event_id=$1',[eventId])).rows[0]??{event_id:eventId,version:0,settings:defaultPromotion},eligible:(await promotionRecipients(c,eventId)).length,globallyEnabled:process.env.EVENT_PROMOTIONS_ENABLED==='true',
 jobs:(await c.query(`SELECT p.kind,j.id,j.status,j.reason,j.recipient,j.provider_id,j.updated_at FROM tpa.event_promotions p JOIN tpa.email_jobs j ON j.dispatch_id=p.dispatch_id WHERE p.event_id=$1 ORDER BY j.created_at DESC LIMIT 100`,[eventId])).rows}));
});}
export async function POST(request:Request) {return operation(async()=>{
 const actor=await authorized(request,'events:manage',true);await authorized(request,'communications:manage');
 const body=record(await jsonBody(request)),eventId=uuid(body.eventId),expected=version(body.version);
 return transaction(async c=>{
  const event=(await c.query('SELECT * FROM tpa.events WHERE id=$1 FOR UPDATE',[eventId])).rows[0];
  if(!event||event.completed_at||event.archived_at||event.status==='cancelled')throw new OperationError('Event is unavailable for promotion changes.',409);
  const current=(await c.query('SELECT * FROM tpa.event_promotion_settings WHERE event_id=$1 FOR UPDATE',[eventId])).rows[0];
  if((current?.version??0)!==expected) throw new OperationError('Promotion settings changed. Reload first.',409);
  if(body.action==='review'||body.action==='approve') {
   if(!current||event.status!=='published'||event.booking_closed||new Date(event.starts_at)<=new Date())throw new OperationError('Review a saved promotion for a future bookable event.',409);
   const recipients=await promotionRecipients(c,eventId),context={eventId,eventVersion:event.version,settingsVersion:current.version,actor:actor.id};
   if(!recipients.length||recipients.length>10000)throw new OperationError('Choose an audience with 1–10,000 eligible members.');
   if(body.action==='review')return {eligible:recipients.length,sample:recipients.slice(0,20).map(p=>({name:p.name,email:p.email})),messages:promotionKinds.filter(k=>current.settings[k]).map(k=>({kind:k,...promotionMessage(event,k,process.env.BETTER_AUTH_URL!)})),reviewToken:promotionReview(recipients,context)};
   try{verifyPromotionReview(body.reviewToken,recipients,context);}catch(error){throw new OperationError(error instanceof Error?error.message:'Review again.',409);}
   if(!promotionKinds.some(k=>current.settings[k]))throw new OperationError('Enable at least one promotional message.');
   const row=(await c.query('UPDATE tpa.event_promotion_settings SET approved_version=version,approved_event_version=$2,approved_at=now(),updated_by=$3 WHERE event_id=$1 RETURNING *',[eventId,event.version,actor.id])).rows[0];
   await audit(c,actor.id,'event.promotion_approved',eventId);return row;
  }
  if(body.action&&body.action!=='save')throw new OperationError('Unknown promotion action.');
  const settings=promotionInput(body.settings);
  const row=(await c.query(`INSERT INTO tpa.event_promotion_settings(event_id,settings,updated_by) VALUES($1,$2,$3) ON CONFLICT(event_id) DO UPDATE SET settings=$2,updated_by=$3,version=tpa.event_promotion_settings.version+1,updated_at=now(),approved_version=NULL,approved_event_version=NULL,approved_at=NULL RETURNING *`,[eventId,settings,actor.id])).rows[0];
  await audit(c,actor.id,'event.promotion_saved',eventId);return row;
 });
});}
