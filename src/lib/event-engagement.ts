import type { Pool, PoolClient } from 'pg';
import { canAccessAsset, type AssetEligibility } from '../domain/event-engagement';
type Database = Pool | PoolClient;
export async function activeEventMember(db:Database,userId:string|null) {
 if(!userId) return false;
 return !!(await db.query(`SELECT 1 FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id WHERE p.user_id=$1 AND m.status='active' AND (m.valid_from IS NULL OR m.valid_from<=current_date) AND (m.valid_until IS NULL OR m.valid_until>=current_date)`,[userId])).rowCount;
}
export async function eventAssetAllowed(db:Database, asset:{event_id:string;eligibility:AssetEligibility;selected_members:string[];status:string}, userId:string|null) {
 if(asset.status!=='published') return false;
 const event=(await db.query('SELECT status,visibility FROM tpa.events WHERE id=$1',[asset.event_id])).rows[0];
 if(!event || event.status!=='published') return false;
 const member=await activeEventMember(db,userId);
 const r=userId?(await db.query(`SELECT r.status,r.payment_status,CASE WHEN a.outcome='attended' THEN a.checked_in_at END AS checked_in_at FROM tpa.event_registrations r LEFT JOIN tpa.event_attendance a ON a.registration_id=r.id WHERE r.event_id=$1 AND r.user_id=$2`,[asset.event_id,userId])).rows[0]:null;
 // Member-only event information may be revisited by its own historical registrants.
 if(event.visibility==='members' && !member && !r) return false;
 const confirmed=r?.status==='registered'&&['paid','not_required'].includes(r.payment_status);
 return canAccessAsset(asset.eligibility,{signedIn:!!userId,activeMember:member,confirmed,attended:!!r?.checked_in_at&&confirmed,selected:!!userId&&asset.selected_members.includes(userId)});
}
export async function memberEventJourney(db:Database,userId:string) {
 const attendance=(await db.query(`SELECT count(DISTINCT r.event_id)::int AS count FROM tpa.event_attendance a JOIN tpa.event_registrations r ON r.id=a.registration_id WHERE r.user_id=$1 AND a.outcome='attended'`,[userId])).rows[0].count as number;
 const badges=(await db.query('SELECT id,name,description,icon,threshold FROM tpa.event_badge_rules WHERE enabled AND threshold<=$1 ORDER BY threshold,name',[attendance])).rows;
 const candidates=(await db.query(`SELECT id,event_id,title,description,type,eligibility,selected_members,status,uploaded_at FROM tpa.event_assets WHERE status='published' ORDER BY uploaded_at DESC`)).rows;
 const resources=[];
 for(const asset of candidates) if(await eventAssetAllowed(db,asset,userId)) {
  const {selected_members: _selected,status: _status,...safe}=asset;
  void _selected;void _status;
  resources.push(safe);
 }
 return {attendanceCount:attendance,badges,resources};
}
