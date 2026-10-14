import { getDatabase } from "@/lib/database";

import { record, uuid, version, text } from "@/domain/operations";

import { operation, authorized, jsonBody, transaction, audit, OperationError } from "@/lib/operation-api";

import { editableEvent, eventHistory, lockOperationalEvent } from '@/lib/event-operations';

export const runtime = "nodejs";

export async function GET(request: Request) {

 return operation(async()=> {

  await authorized(request,'events:manage');

  const q=new URL(request.url).searchParams,eventId=uuid(q.get('eventId'));

  const rows=(await getDatabase().query(`SELECT r.id,r.status,r.version,r.registered_at,r.payment_updated_at,r.payment_status,r.fee_paise,u.name,u.email,p.mobile_normalized AS mobile,m.membership_number,

   CASE WHEN a.outcome='attended' THEN a.checked_in_at END AS checked_in_at,coalesce(a.outcome,'unmarked') AS outcome,coalesce(a.version,0) AS attendance_version,coalesce(a.note,'') AS attendance_note

   FROM tpa.event_registrations r JOIN public."user" u ON u.id=r.user_id LEFT JOIN tpa.people p ON p.user_id=u.id

   LEFT JOIN LATERAL (SELECT membership_number FROM tpa.memberships WHERE person_id=p.id ORDER BY (status='active') DESC,id LIMIT 1) m ON true

   LEFT JOIN tpa.event_attendance a ON a.registration_id=r.id WHERE r.event_id=$1 ORDER BY u.name,r.id`,[eventId])).rows;

  if(!q.has('page')) return rows; // Retain the accepted legacy array contract.

  const page=Number(q.get('page')),search=(q.get('search')??'').toLowerCase(),state=q.get('registration')??'all',attendance=q.get('attendance')??'all',payment=q.get('payment')??'all';

  if(!Number.isInteger(page)||page<1) throw new OperationError('Choose a valid page.');

  if(!['all','registered','confirmed','cancelled'].includes(state)||!['all','attended','absent','unmarked'].includes(attendance)||!['all','paid','pending','failed','refunded','cancelled','not_required'].includes(payment)) throw new OperationError('Choose valid attendee filters.');

  const filtered=rows.filter(r=>[r.name,r.email,r.mobile,r.membership_number].join(' ').toLowerCase().includes(search)&&(state==='all'||r.status===state||(state==='confirmed'&&r.status==='registered'&&['paid','not_required'].includes(r.payment_status)))&&(attendance==='all'||r.outcome===attendance)&&(payment==='all'||r.payment_status===payment));

  return {rows:filtered.slice((page-1)*50,page*50),total:filtered.length,page,pageSize:50};

 });

}

export async function POST(request:Request) {

 return operation(async()=> {

  const actor=await authorized(request,'events:manage',true),i=record(await jsonBody(request,64000));

  const batch=Array.isArray(i.entries),rawEntries=Array.isArray(i.entries)?i.entries:[],status=String(i.outcome??'attended');

  if(!['attended','absent','unmarked'].includes(status)) throw new OperationError('Choose attended, absent or unmarked.');

  if(batch && (!rawEntries.length||rawEntries.length>100)) throw new OperationError('Select one to 100 attendees.');

  const entries=batch?rawEntries.map((x:unknown)=>{const r=record(x);return {id:uuid(r.id),registrationVersion:version(r.version),attendanceVersion:version(r.attendanceVersion)};}):[{id:uuid(i.registrationId),registrationVersion:i.registrationVersion===undefined?undefined:version(i.registrationVersion),attendanceVersion:i.outcome===undefined?undefined:version(i.version)}];

  if(new Set(entries.map((r:{id:string})=>r.id)).size!==entries.length) throw new OperationError('Select distinct attendees.');

  const note=batch||i.outcome!==undefined?text(i.note,'Attendance correction note',1000,3):'';

  return transaction(async c=> {

   const match=batch?{event_id:uuid(i.eventId)}:(await c.query('SELECT event_id FROM tpa.event_registrations WHERE id=$1',[entries[0].id])).rows[0];

   if(!match) throw new OperationError('Registration not found.',404);

   const event=await lockOperationalEvent(c,match.event_id);editableEvent(event);

   if(event.status!=='published'||new Date(event.starts_at)>new Date()) throw new OperationError('Check-in requires an active registration at a started event.',409);

   const results=[];

   for(const entry of entries) {

    const r=(await c.query('SELECT * FROM tpa.event_registrations WHERE id=$1 AND event_id=$2 FOR UPDATE',[entry.id,event.id])).rows[0];

    const prior=(await c.query('SELECT * FROM tpa.event_attendance WHERE registration_id=$1 FOR UPDATE',[entry.id])).rows[0];

    const conflict=!r||(entry.registrationVersion!==undefined&&r.version!==entry.registrationVersion)||(entry.attendanceVersion!==undefined&&(prior?.version??0)!==entry.attendanceVersion)||(status!=='unmarked'&&(r.status!=='registered'||!['paid','not_required'].includes(r.payment_status)));

    if(conflict) {if(!batch) throw new OperationError('Attendance changed or registration is not confirmed. Reload.',409);results.push({id:entry.id,saved:false,error:'Attendance changed or registration is not confirmed.'});continue;}

    const duplicate=prior?.outcome===status;

    if(!duplicate) {

     await c.query(`INSERT INTO tpa.event_attendance(registration_id,checked_in_by,outcome,note) VALUES($1,$2,$3,$4) ON CONFLICT(registration_id) DO UPDATE SET outcome=$3,note=$4,checked_in_by=$2,checked_in_at=CASE WHEN $3='attended' AND tpa.event_attendance.outcome<>'attended' THEN now() ELSE tpa.event_attendance.checked_in_at END,version=tpa.event_attendance.version+1`,[entry.id,actor.id,status,note]);

     await eventHistory(c,event.id,actor.id,'attendance.'+status,{registrationId:entry.id,before:prior??null,outcome:status,note});

     await audit(c,actor.id,!batch && i.outcome===undefined ? 'attendance.checked_in' : 'attendance.'+status,entry.id);

     await c.query('UPDATE tpa.event_badges SET revoked_at=now() WHERE registration_id=$1',[entry.id]);

    }

    results.push({id:entry.id,saved:true,duplicate});

   }

   if(results.some(r=>r.saved&&!r.duplicate)) await c.query('UPDATE tpa.events SET attendance_finalized_at=NULL WHERE id=$1',[event.id]);

   return batch?{results}:{checkedIn:status==='attended',duplicate:results[0].duplicate,learningHours:null};

  });

 });

}
