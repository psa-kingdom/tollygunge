import {defaultPromotion} from '../src/domain/event-engagement';
import {approveFinance,recordRegistrationFinance} from "../tests/helpers/finance-acceptance.mts";
import assert from 'node:assert/strict';
import type {Browser} from '@playwright/test';
import {expect} from '@playwright/test';
import type {Pool} from 'pg';
import {jsPDF} from 'jspdf';
import {writeFile} from 'node:fs/promises';
import {istInput} from '../src/domain/event-flow';
export async function operationalBrowserJourney({browser,base,cookies,db,dir,request,pass,communications}:{browser:Browser;base:string;cookies:string[];db:Pool;dir:string;request:(path:string,body?:unknown,actor?:number,status?:number)=>Promise<unknown>;pass:(s:string)=>void;communications:(eventId:string,stage:'promotion'|'reminder')=>Promise<void>}) {
 const check=expect.configure({timeout:30000});
 const staffContext=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const memberContext=await browser.newContext({viewport:{width:390,height:900},acceptDownloads:true});
 await staffContext.addCookies([{name:'better-auth.session_token',value:cookies[0],url:base}]);await memberContext.addCookies([{name:'better-auth.session_token',value:cookies[1],url:base}]);
 const staff=await staffContext.newPage(),member=await memberContext.newPage(),errors:string[]=[];
 for(const page of [staff,member])page.on('pageerror',e=>errors.push(e.message));
 const title='UI Operational Workshop';
 // The simplified editor owns basic event details; advanced lifecycle settings
 // remain tested through their authenticated APIs rather than removed panels.
 await staff.goto(base+'/admin/workspaces/events');
 await staff.getByRole('button',{name:'Create new event',exact:true}).click();
 await staff.getByLabel('Event title',{exact:true}).fill(title);
 await staff.getByLabel('Venue or meeting link',{exact:true}).fill('TPA Test Auditorium');
 await staff.getByLabel('Starts · IST',{exact:true}).fill(istInput(new Date(Date.now()+2*86400000).toISOString()));
 await staff.getByLabel('Ends · IST',{exact:true}).fill(istInput(new Date(Date.now()+2*86400000+3600000).toISOString()));
 await staff.getByRole('button',{name:'Create event',exact:true}).click();
 await check(staff.getByRole('status').filter({hasText:'Event draft created'})).toBeVisible();
 type EventRow={id:string;title:string;version:number};
 const event=(await request('/api/staff/events') as EventRow[]).find(e=>e.title===title);assert.ok(event);
 let current=(await request('/api/staff/events?id='+event.id) as EventRow[])[0];
 await request('/api/staff/events',{action:'save',id:event.id,version:current.version,title,description:'A practical workshop with presentations and follow-up.',location:'TPA Test Auditorium',startsAt:new Date(Date.now()+2*86400000).toISOString(),endsAt:new Date(Date.now()+2*86400000+3600000).toISOString(),capacity:10,feePaise:75000,visibility:'members',deliveryMode:'location',speakers:[{name:'Dr. Operational Speaker',credentials:'Community educator'}],reminders:{enabled:true,offsets:[60],includePending:true}});
 async function operate(action:string,extra:Record<string,unknown>={}){
  current=(await request('/api/staff/events?id='+event!.id) as EventRow[])[0];
  return request('/api/staff/events/operations',{eventId:event!.id,version:current.version,action,...extra});
 }
 const accounts=await request('/api/staff/payment-details') as {records:{id:string;status:string}[]};
 const account=accounts.records.find(a=>a.status==='active');assert.ok(account);
 await operate('payment.configure',{accountIds:[account.id],reason:'Verified test workshop payee'});
 current=(await request('/api/staff/events?id='+event.id) as EventRow[])[0];
 await request('/api/staff/events',{action:'publish',id:event.id,version:current.version});
 const promotion=await request('/api/staff/event-promotions',{eventId:event.id,version:0,action:'save',settings:{...defaultPromotion,registration_open:true}}) as {version:number};
 const review=await request('/api/staff/event-promotions',{eventId:event.id,version:promotion.version,action:'review'}) as {reviewToken:string};
 await request('/api/staff/event-promotions',{eventId:event.id,version:promotion.version,action:'approve',reviewToken:review.reviewToken});
 await communications(event.id,'promotion');
 await staff.goto(base+'/admin/workspaces/events?id='+event.id);
 await check(staff.getByRole('dialog',{name:title,exact:true})).toBeVisible();
 pass('Simplified event creation and details; authenticated payment configuration and promotion review');
 await member.goto(base+'/member/events?eventId='+event.id);const card=member.locator('article').filter({has:member.getByRole('heading',{name:title,exact:true})});
 await card.getByRole('button',{name:'Reserve place'}).click();await check(card.getByText(/^Receipt pending/)).toBeVisible();

 const registration=(await db.query('SELECT id FROM tpa.event_registrations WHERE event_id=$1 AND user_id=(SELECT "userId" FROM public.session WHERE token=$2)',[event.id,decodeURIComponent(cookies[1]).split('.')[0]])).rows[0];
 await recordRegistrationFinance(db,request,registration.id,7,'receipt','UI-UPI-750');
 await staff.goto(base+'/admin/workspaces/payments/events/'+event.id);
 await staff.getByRole('tab',{name:'Participant collections',exact:true}).click();
 await check(staff.getByRole('row').filter({hasText:'member 2'})).toContainText('750.00');
 await member.reload();await check(card).toContainText('Registration confirmed');
 pass('Member booking and separately approved admin receipt remain visible in event collections');
 await communications(event.id,'reminder');
 // Time progression is the only database fixture operation in this UI lifecycle.
 await db.query("UPDATE tpa.events SET starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',version=version+1 WHERE id=$1",[event.id]);
 await staff.goto(base+'/admin/workspaces/events?id='+event.id);
 await staff.getByRole('button',{name:'Participants & attendance',exact:true}).click();
 await staff.getByRole('button',{name:'Check in',exact:true}).click();
 await check(staff.getByRole('button',{name:'Checked in',exact:true})).toBeVisible();
 await operate('attendance.finalize');
 await staff.goto(base+'/admin/workspaces/payments/events/'+event.id);
 await staff.getByRole('button',{name:'Add Expense',exact:true}).click();
 const expense=staff.getByRole('group',{name:'Draft expense sheet',exact:true});
 await expense.getByLabel('Expense header',{exact:true}).fill('Venue');
 await expense.getByLabel('Description',{exact:true}).fill('Auditorium rental');
 await expense.getByLabel('Expense date',{exact:true}).fill('2026-10-12');
 await expense.getByLabel('Amount (₹)',{exact:true}).fill('250');
 await expense.getByRole('button',{name:'Submit expenses for approval',exact:true}).click();
 await check(staff.getByText('Pending approval',{exact:true}).first()).toBeVisible();
 const sheet=(await db.query("SELECT id FROM tpa.finance_entries WHERE event_id=$1 AND kind='expenses' AND status='submitted'",[event.id])).rows[0];
 await approveFinance(db,request,event.id,sheet.id,7);
 const doc=new jsPDF();doc.text('TPA Workshop Presentation and Follow-up',20,20);const bytes=Buffer.from(doc.output('arraybuffer'));
 await writeFile(dir+'/workshop-resource.pdf',bytes);
 for(const [type,resourceTitle] of [['presentation','Workshop presentation'],['photos','Workshop photos'],['report','Workshop report'],['other','Workshop reading resource']]) {
  const data=type==='photos'?Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'):bytes;
  const body=new FormData();body.set('details',JSON.stringify({eventId:event.id,title:resourceTitle,description:'Workshop follow-up',type,eligibility:'attended',status:'published',selectedMembers:[]}));body.set('file',new Blob([data],{type:type==='photos'?'image/png':'application/pdf'}),type==='photos'?'workshop.png':'workshop.pdf');
  const response=await fetch(base+'/api/staff/event-assets',{method:'POST',headers:{Cookie:'better-auth.session_token='+cookies[0],Origin:base},body});assert.equal(response.status,200);
 }
 await operate('complete',{financialReviewed:true});
 await check.poll(async()=>Boolean((await db.query('SELECT completed_at FROM tpa.events WHERE id=$1',[event.id])).rows[0].completed_at)).toBe(true);
 await staff.goto(base+'/admin/workspaces/events?id='+event.id);await check(staff.getByRole('dialog')).toContainText('Completed');
 await member.reload();await check(card).toContainText('Attendance');await check(card).toContainText('badge');
 await card.getByText('Resources, perks and receipt history',{exact:true}).click();
 await check(member.getByRole('link',{name:'Workshop presentation',exact:true}).first()).toBeVisible();
 const download=member.waitForEvent('download');await member.getByRole('link',{name:'Workshop presentation',exact:true}).first().click();await (await download).saveAs(dir+'/member-presentation.pdf');
 await member.screenshot({path:dir+'/member-completed-workshop.png',fullPage:true});await staff.screenshot({path:dir+'/admin-completed-workshop.png',fullPage:true});
 assert.deepEqual(errors,[]);pass('UI check-in and expenses; API resource uploads and completion; member badge, history and authorized download');
 await memberContext.close();await staffContext.close();
}
