import { authorized, operation } from '@/lib/operation-api';
import { getDatabase } from '@/lib/database';
import { uuid } from '@/domain/operations';
import { eventAssetAllowed } from '@/lib/event-engagement';
export async function GET(request:Request) {return operation(async()=> {
 const actor=await authorized(request),id=uuid(new URL(request.url).searchParams.get('eventId')),db=getDatabase();
 const registration=(await db.query('SELECT id FROM tpa.event_registrations WHERE event_id=$1 AND user_id=$2',[id,actor.id])).rows[0];
 const candidates=(await db.query("SELECT * FROM tpa.event_assets WHERE event_id=$1 AND status='published' AND eligibility<>'finance' ORDER BY uploaded_at DESC",[id])).rows;
 const assets=[];
 for(const a of candidates) if(await eventAssetAllowed(db,a,actor.id)) assets.push({id:a.id,title:a.title,type:a.type});
 const perks=registration?(await db.query('SELECT id,title,notes,granted_at,revoked_at FROM tpa.event_entitlements WHERE registration_id=$1 ORDER BY granted_at DESC',[registration.id])).rows:[];
 const payments=registration?(await db.query('SELECT to_status,fee_paise,reference,created_at FROM tpa.event_payment_history WHERE registration_id=$1 ORDER BY created_at',[registration.id])).rows:[];
 return {assets,perks,payments};
});}
