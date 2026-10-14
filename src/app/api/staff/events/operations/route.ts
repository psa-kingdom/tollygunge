import { randomUUID } from 'node:crypto';

import { getDatabase } from '@/lib/database';

import { hasPermission } from '@/domain/access';

import { record, uuid, version, text } from '@/domain/operations';

import { expenseCategories, moneyInput, recordingUrl } from '@/domain/event-operations';

import { operation, authorized, jsonBody, transaction, OperationError } from '@/lib/operation-api';

import { lockOperationalEvent, editableEvent, eventHistory, snapshotAccounts, freezeEventPayment, eventFinancials } from '@/lib/event-operations';

import { sealMail } from '@/lib/onboarding-mail';

export async function GET(request: Request) {

 return operation(async()=> {

  const actor=await authorized(request,'events:manage'), id=uuid(new URL(request.url).searchParams.get('eventId')), db=getDatabase();

  const event=(await db.query('SELECT * FROM tpa.events WHERE id=$1',[id])).rows[0];

  if (!event) throw new OperationError('Event not found.',404);

  const financial=hasPermission(actor.roles,'payments:manage');

  return {event, accounts:(await db.query("SELECT id,version,active_snapshot AS details FROM tpa.payment_details WHERE status='active' ORDER BY id")).rows,

   configurations:(await db.query('SELECT revision,accounts,reason,created_at FROM tpa.event_payment_configurations WHERE event_id=$1 ORDER BY revision DESC',[id])).rows,

   assets:(await db.query("SELECT * FROM tpa.event_assets WHERE event_id=$1 AND ($2 OR eligibility<>'finance') ORDER BY uploaded_at DESC",[id,financial])).rows,

   entitlements:(await db.query('SELECT x.*,r.user_id,u.name FROM tpa.event_entitlements x JOIN tpa.event_registrations r ON r.id=x.registration_id JOIN public."user" u ON u.id=r.user_id WHERE r.event_id=$1 ORDER BY x.granted_at DESC',[id])).rows,

   announcements:(await db.query('SELECT * FROM tpa.event_announcements WHERE event_id=$1 ORDER BY id',[id])).rows,

   financials:financial?await eventFinancials(db,id):null,

   expenses:financial?(await db.query('SELECT * FROM tpa.event_expenses WHERE event_id=$1 ORDER BY expense_date DESC,id',[id])).rows:[],

   history:(await db.query("SELECT action,created_at,actor_id,CASE WHEN $2 THEN details ELSE '{}'::jsonb END AS details FROM tpa.event_operation_history WHERE event_id=$1 AND ($2 OR action NOT LIKE 'expense.%') ORDER BY id DESC LIMIT 100",[id,financial])).rows};

 });

}

export async function POST(request: Request) {

 return operation(async()=> {

  const i=record(await jsonBody(request)), action=String(i.action), financial=action.startsWith('expense.') || ['complete','reopen','archive'].includes(action);

  const actor=await authorized(request,financial?'payments:manage':'events:manage',true);

  if (['complete','reopen','archive'].includes(action)) await authorized(request,'events:manage',true);

  const id=uuid(i.eventId);

  return transaction(async c=> {

   const e=await lockOperationalEvent(c,id,version(i.version));

   if(action==='reopen') {

    if(!e.completed_at && !e.archived_at) throw new OperationError('Event is already open.',409);

    const reason=text(i.reason,'Reopening reason',1000,3);

    await c.query('UPDATE tpa.events SET completed_at=NULL,archived_at=NULL,financial_reviewed_at=NULL,booking_closed=true,version=version+1 WHERE id=$1',[id]);

    await eventHistory(c,id,actor.id,'event.reopened',{reason});return {saved:true};

   }

   if(action==='archive') {

    if(!e.completed_at || e.archived_at) throw new OperationError('Complete the event before archiving.',409);

    await c.query('UPDATE tpa.events SET archived_at=now(),version=version+1 WHERE id=$1',[id]);

    await eventHistory(c,id,actor.id,'event.archived');return {saved:true};

   }

   editableEvent(e);

   let details:unknown=i;

   if(action==='complete') {

    if(e.status==='draft' || new Date(e.ends_at)>new Date() || !e.attendance_finalized_at || i.financialReviewed!==true) throw new OperationError('End the event, finalize attendance and acknowledge financial review before completion.',409);

    details={financials:await eventFinancials(c,id),financialReviewed:true};

    await c.query("UPDATE tpa.event_badges b SET revoked_at=now() FROM tpa.event_registrations r WHERE b.registration_id=r.id AND r.event_id=$1 AND (r.status<>'registered' OR r.payment_status NOT IN ('paid','not_required') OR NOT EXISTS(SELECT 1 FROM tpa.event_attendance a WHERE a.registration_id=r.id AND a.outcome='attended'))",[id]);
    await c.query("INSERT INTO tpa.event_badges(registration_id) SELECT a.registration_id FROM tpa.event_attendance a JOIN tpa.event_registrations r ON r.id=a.registration_id WHERE r.event_id=$1 AND a.outcome='attended' AND r.status='registered' AND r.payment_status IN ('paid','not_required') ON CONFLICT(registration_id) DO UPDATE SET revoked_at=NULL",[id]);

    await c.query('UPDATE tpa.events SET completed_at=now(),financial_reviewed_at=now(),booking_closed=true WHERE id=$1',[id]);

   } else if(action==='booking.close' || action==='booking.open') {

    if(action==='booking.open' && (e.status!=='published' || new Date(e.starts_at)<=new Date())) throw new OperationError('Only a future published event can reopen booking.',409);

    await c.query('UPDATE tpa.events SET booking_closed=$2 WHERE id=$1',[id,action==='booking.close']);

   } else if(action==='payment.configure') {

    if(!Array.isArray(i.accountIds) || i.accountIds.length>10) throw new OperationError('Choose up to ten payment accounts.');

    const ids=[...new Set(i.accountIds.map(uuid))];

    if(e.fee_paise>0 && !ids.length) throw new OperationError('Choose at least one account for a paid event.');

    await snapshotAccounts(c,ids);

    const reason=text(i.reason,'Payment configuration reason',1000,3);

    if(e.status==='cancelled') throw new OperationError('Cancelled event payment instructions are historical.',409);

    await c.query('UPDATE tpa.events SET payment_account_ids=$2 WHERE id=$1',[id,ids]);

    if(e.status==='published') await freezeEventPayment(c,{...e,payment_account_ids:ids},actor.id,reason);

    details={accountIds:ids,reason};

   } else if(action==='attendance.finalize') {

    if(e.status==='draft' || new Date(e.ends_at)>new Date()) throw new OperationError('Finalize attendance after the event ends.',409);

    await c.query(`INSERT INTO tpa.event_attendance(registration_id,outcome,checked_in_by)

      SELECT r.id,'absent',$2 FROM tpa.event_registrations r WHERE r.event_id=$1 AND r.status='registered' AND r.payment_status IN ('paid','not_required') AND NOT EXISTS(SELECT 1 FROM tpa.event_attendance a WHERE a.registration_id=r.id AND a.outcome='attended')

      ON CONFLICT(registration_id) DO UPDATE SET outcome='absent',version=tpa.event_attendance.version+1,checked_in_by=$2 WHERE tpa.event_attendance.outcome='unmarked'`,[id,actor.id]);

    await c.query('UPDATE tpa.events SET attendance_finalized_at=now() WHERE id=$1',[id]);

   } else if(action==='expense.save') {

    if(!expenseCategories.some(c=>c===i.category)) throw new OperationError('Choose an expense category.');

    const expenseId=i.id?uuid(i.id):randomUUID(), amount=moneyInput(i.amountPaise), description=text(i.description,'Description',1000,3);

    const date=String(i.date); if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw new OperationError('Choose a valid expense date.');

    const account=i.accountId?(await snapshotAccounts(c,[uuid(i.accountId)]))[0]:null;

    const receipt=i.receiptId?uuid(i.receiptId):null;

    if(receipt && !(await c.query("SELECT 1 FROM tpa.event_assets WHERE id=$1 AND event_id=$2 AND eligibility='finance' AND status='published'",[receipt,id])).rowCount) throw new OperationError('Choose a receipt belonging to this event.');

    const args=[expenseId,id,i.category,description,amount,date,text(i.vendor??'','Vendor',160),text(i.method??'','Method',80),JSON.stringify(account),text(i.notes??'','Notes',1000),receipt,actor.id];

    if(i.id) {

     const prior=(await c.query('SELECT * FROM tpa.event_expenses WHERE id=$1 AND event_id=$2 FOR UPDATE',[expenseId,id])).rows[0];

     if(!prior || prior.version!==version(i.expenseVersion) || prior.voided_at) throw new OperationError('Expense changed. Reload.',409);

     if(!i.accountId) args[8]=JSON.stringify(prior.account_snapshot);

     await c.query('UPDATE tpa.event_expenses SET category=$3,description=$4,amount_paise=$5,expense_date=$6,vendor=$7,method=$8,account_snapshot=$9,notes=$10,receipt_id=$11,updated_by=$12,version=version+1 WHERE id=$1 AND event_id=$2',args);

     details={before:prior,after:args};

    } else {await c.query('INSERT INTO tpa.event_expenses(id,event_id,category,description,amount_paise,expense_date,vendor,method,account_snapshot,notes,receipt_id,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',args);details={id:expenseId,values:args};}

    await c.query('UPDATE tpa.events SET financial_reviewed_at=NULL WHERE id=$1',[id]);

   } else if(action==='expense.void') {

    const reason=text(i.reason,'Void reason',1000,3);

    const prior=(await c.query('SELECT * FROM tpa.event_expenses WHERE id=$1 AND event_id=$2 FOR UPDATE',[uuid(i.id),id])).rows[0];

    if(!prior || prior.version!==version(i.expenseVersion) || prior.voided_at) throw new OperationError('Expense changed. Reload.',409);

    await c.query('UPDATE tpa.event_expenses SET voided_at=now(),version=version+1,updated_by=$2 WHERE id=$1',[prior.id,actor.id]);details={before:prior,reason};

   } else if(action==='asset.link') {

    if(!['members','confirmed','attended'].includes(String(i.audience))) throw new OperationError('Choose resource access.');

    await c.query("INSERT INTO tpa.event_assets(id,event_id,title,eligibility,url,updated_by,type,status) VALUES($1,$2,$3,$4,$5,$6,'other','published')",[randomUUID(),id,text(i.title,'Title',160,3),i.audience,recordingUrl(i.url),actor.id]);

   } else if(action==='asset.revoke') {

    if(!(await c.query("UPDATE tpa.event_assets SET status='archived',version=version+1 WHERE id=$1 AND event_id=$2 AND version=$3 AND eligibility<>'finance' AND status<>'archived'",[uuid(i.id),id,version(i.assetVersion)])).rowCount) throw new OperationError('Asset changed. Reload.',409);

   } else if(action==='perk.grant') {

    const registration=uuid(i.registrationId);

    if(!(await c.query('SELECT 1 FROM tpa.event_registrations WHERE id=$1 AND event_id=$2',[registration,id])).rowCount) throw new OperationError('Choose an event registrant.');

    await c.query('INSERT INTO tpa.event_entitlements(id,registration_id,title,notes,granted_by) VALUES($1,$2,$3,$4,$5)',[randomUUID(),registration,text(i.title,'Perk',160,3),text(i.notes??'','Notes',1000),actor.id]);

   } else if(action==='perk.revoke') {

    if(!(await c.query('UPDATE tpa.event_entitlements x SET revoked_at=now(),version=x.version+1 FROM tpa.event_registrations r WHERE x.id=$1 AND x.version=$2 AND x.revoked_at IS NULL AND r.id=x.registration_id AND r.event_id=$3',[uuid(i.id),version(i.perkVersion),id])).rowCount) throw new OperationError('Perk changed. Reload.',409);

   } else if(action==='announcement.save') {

    const announcementId=i.id?uuid(i.id):randomUUID(), subject=text(i.subject,'Subject',160,3), body=text(i.body,'Message',4000,3);

    if(i.id) {if(!(await c.query('UPDATE tpa.event_announcements SET subject=$3,body=$4,version=version+1 WHERE id=$1 AND event_id=$2 AND version=$5 AND sent_at IS NULL',[announcementId,id,subject,body,version(i.announcementVersion)])).rowCount) throw new OperationError('Announcement changed or sent.',409);}

    else await c.query('INSERT INTO tpa.event_announcements(id,event_id,subject,body,created_by) VALUES($1,$2,$3,$4,$5)',[announcementId,id,subject,body,actor.id]);

   } else if(action==='announcement.send') {

    const a=(await c.query('SELECT * FROM tpa.event_announcements WHERE id=$1 AND event_id=$2 FOR UPDATE',[uuid(i.id),id])).rows[0];

    if(!a || a.version!==version(i.announcementVersion) || a.sent_at) throw new OperationError('Announcement changed or already sent.',409);

    if(e.status!=='published') throw new OperationError('Announcements require a published event.',409);

    const recipients=(await c.query('SELECT r.id,r.user_id,u.email FROM tpa.event_registrations r JOIN public."user" u ON u.id=r.user_id WHERE r.event_id=$1 AND r.status=\'registered\'',[id])).rows;

    for(const r of recipients) await c.query("INSERT INTO tpa.onboarding_mail(id,dedupe,user_id,recipient,kind,payload,event_id,registration_id) VALUES($1,$2,$3,$4,'event_update',$5,$6,$7) ON CONFLICT(dedupe) DO NOTHING",[randomUUID(),`event-announcement-${a.id}-${r.id}`,r.user_id,r.email,sealMail({subject:a.subject.replace(/[\r\n]/g,' '),text:a.body,html:'<p>'+String(a.body).replace(/[&<>"']/g,(x:string)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]!)).replaceAll('\n','<br>')+'</p>'}),id,r.id]);

    await c.query('UPDATE tpa.event_announcements SET sent_at=now(),version=version+1 WHERE id=$1',[a.id]);details={announcementId:a.id,recipientCount:recipients.length};

   } else throw new OperationError('Unknown event operation.');

   await c.query('UPDATE tpa.events SET version=version+1,updated_by=$2 WHERE id=$1',[id,actor.id]);

   await eventHistory(c,id,actor.id,action,details);

   return {saved:true};

  });

 });

}

