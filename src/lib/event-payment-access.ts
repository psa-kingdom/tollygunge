import 'server-only';
import { getDatabase } from './database';
import { OperationError } from './operation-api';
import { hasPermission } from '@/domain/access';
export async function eventPaymentAccess(eventId:string, actor:{id:string;roles:readonly string[]}) {
 const db=getDatabase(), e=(await db.query('SELECT * FROM tpa.events WHERE id=$1',[eventId])).rows[0];
 if(!e) throw new OperationError('Event not found.',404);
 const r=(await db.query('SELECT * FROM tpa.event_registrations WHERE event_id=$1 AND user_id=$2',[eventId,actor.id])).rows[0];
 const staff=hasPermission(actor.roles,'events:manage')||hasPermission(actor.roles,'payments:manage');
 const member=(await db.query("SELECT 1 FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id WHERE p.user_id=$1 AND m.status='active' AND (m.valid_from IS NULL OR m.valid_from<=current_date) AND (m.valid_until IS NULL OR m.valid_until>=current_date)",[actor.id])).rowCount;
 if(!staff && !r && (e.status!=='published' || (e.visibility==='members'&&!member))) throw new OperationError('Event not found.',404);
 const revision=r?r.payment_revision:e.payment_revision;
 if(revision===null || revision===undefined) return {legacy:true,records:(await db.query("SELECT id,active_snapshot AS details FROM tpa.payment_details WHERE status='active' ORDER BY updated_at DESC")).rows};
 const config=(await db.query('SELECT accounts FROM tpa.event_payment_configurations WHERE event_id=$1 AND revision=$2',[eventId,revision])).rows[0];
 return {legacy:false,revision,records:(config?.accounts??[]).map((a:{id:string;details:unknown})=>({id:a.id,details:a.details}))};
}
