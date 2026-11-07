import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
export type FinanceRequest = (path:string,body?:unknown,actor?:number,status?:number)=>Promise<unknown>;
export async function approveFinance(db:Pool,request:FinanceRequest,eventId:string,id:string,reviewer:number) {
 const entry=(await db.query('SELECT version,status FROM tpa.finance_entries WHERE id=$1',[id])).rows[0];
 assert.equal(entry.status,'submitted');
 await request('/api/staff/finance',{action:'approve',eventId,id,version:entry.version,reason:'Reviewed synthetic acceptance evidence'},reviewer);
 assert.equal((await db.query('SELECT status FROM tpa.finance_entries WHERE id=$1',[id])).rows[0].status,'approved');
}
export async function recordRegistrationFinance(db:Pool,request:FinanceRequest,registrationId:string,reviewer:number,kind='receipt',reference='BANK-TEST-001') {
 const r=(await db.query('SELECT * FROM tpa.event_registrations WHERE id=$1',[registrationId])).rows[0];
 const id=randomUUID();
 await request('/api/staff/finance',{action:kind+'.create',id,eventId:r.event_id,registrationId,amountPaise:r.fee_paise,date:new Date().toISOString().slice(0,10),method:'Bank transfer',reference,note:'Synthetic bank reconciliation evidence'});
 assert.equal((await db.query('SELECT payment_status FROM tpa.event_registrations WHERE id=$1',[registrationId])).rows[0].payment_status,r.payment_status,'Submission must not confirm a receipt or refund');
 await approveFinance(db,request,r.event_id,id,reviewer);
}
