import { currentActor } from '@/lib/actor';
import { getDatabase } from '@/lib/database';
import { hasPermission } from '@/domain/access';
import { uuid } from '@/domain/operations';
import { eventAssetAllowed } from '@/lib/event-engagement';
import { eventAssetStorage } from '@/lib/private-storage';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 let id;try{id=uuid((await params).id);}catch{return new Response(null,{status:404});}
 const actor=await currentActor(request.headers),db=getDatabase();
 const asset=(await db.query('SELECT * FROM tpa.event_assets WHERE id=$1',[id])).rows[0];
 const staff=!!actor&&hasPermission(actor.roles,'events:manage')&&(asset?.eligibility!=='finance'||hasPermission(actor.roles,'payments:manage'));
 if(!asset || (!staff && !await eventAssetAllowed(db,asset,actor?.id??null))) return new Response(null,{status:404,headers:{'Cache-Control':'private, no-store'}});
 try {
  if(actor) await db.query("INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'event.asset_downloaded',$2)",[actor.id,id]);
  if(asset.url) {const {eventResourceUrl}=await import('@/domain/event-engagement');return new Response(null,{status:303,headers:{Location:eventResourceUrl(asset.url),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});}
  const stream=await eventAssetStorage(id,'read');
  const extension=asset.content_type==='application/pdf'?'pdf':asset.content_type==='image/png'?'png':'jpg';
  return new Response(stream as ReadableStream,{headers:{'Content-Type':asset.content_type,'Content-Disposition':`attachment; filename="event-resource.${extension}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 }catch{return Response.json({error:'Resource temporarily unavailable.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
