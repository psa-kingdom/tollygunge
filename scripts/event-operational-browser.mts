import assert from 'node:assert/strict';
import type {Browser} from '@playwright/test';
import {expect} from '@playwright/test';
import type {Pool} from 'pg';
import {jsPDF} from 'jspdf';
import {writeFile,readFile} from 'node:fs/promises';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
import {istInput} from '../src/domain/event-flow';
export async function operationalBrowserJourney({browser,base,cookies,db,dir,request,pass,communications}:{browser:Browser;base:string;cookies:string[];db:Pool;dir:string;request:(path:string,body?:unknown,actor?:number,status?:number)=>Promise<unknown>;pass:(s:string)=>void;communications:(eventId:string,stage:'promotion'|'reminder')=>Promise<void>}) {
 const check=expect.configure({timeout:30000});
 const staffContext=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const memberContext=await browser.newContext({viewport:{width:390,height:900},acceptDownloads:true});
 await staffContext.addCookies([{name:'better-auth.session_token',value:cookies[0],url:base}]);await memberContext.addCookies([{name:'better-auth.session_token',value:cookies[1],url:base}]);
 const staff=await staffContext.newPage(),member=await memberContext.newPage(),errors:string[]=[];
 for(const page of [staff,member])page.on('pageerror',e=>errors.push(e.message));
 const title='UI Operational Workshop';
 await staff.goto(base+'/admin/workspaces/events');await staff.getByRole('complementary',{name:'Event library',exact:true}).getByRole('button',{name:'New event',exact:true}).click();
 await staff.getByLabel('Title',{exact:true}).fill(title);await staff.getByLabel('Description',{exact:true}).fill('A practical workshop with a presentation, photos, report and member follow-up.');
 await staff.getByLabel('Venue / joining instructions').fill('TPA Test Auditorium');
 await staff.getByLabel('Starts (IST)').fill(istInput(new Date(Date.now()+2*86400000).toISOString()));await staff.getByLabel('Ends (IST)').fill(istInput(new Date(Date.now()+2*86400000+3600000).toISOString()));
 await staff.getByLabel('Capacity',{exact:true}).fill('10');await staff.getByLabel('Registration fee').fill('750');
 await staff.getByLabel('Visibility').selectOption('members');
 await staff.getByRole('button',{name:'Add speaker',exact:true}).click();await staff.getByLabel('Name',{exact:true}).fill('Dr. Operational Speaker');
 // Account selection may be part of creation or the saved-draft command center.
 await staff.getByLabel('Event payment accounts').selectOption({label:'Workshop UPI · TPA Test Association'});
 await staff.getByRole('button',{name:'Save draft',exact:true}).click();
 await check(staff.getByRole('status')).toContainText('Event draft saved');
 await check(staff.getByLabel('Title',{exact:true})).toHaveValue(title);
 const event=(await request('/api/staff/events') as {id:string;title:string}[]).find(e=>e.title===title);assert.ok(event);
 const booking=staff.locator('#event-booking');await booking.locator('summary').first().click();
 await booking.getByRole('checkbox',{name:'Workshop UPI · TPA Test Association',exact:true}).check();await booking.getByLabel('Configuration reason').fill('Verified test workshop payee');await booking.getByRole('button',{name:'Save event payment configuration'}).click();
 await check(staff.getByRole('region',{name:'Event command center'}).locator('[data-operation-message]').first()).toContainText('Saved');
 await staff.getByRole('link',{name:'Flyer / Promotion',exact:true}).click();
 await check(staff.getByRole('button',{name:'Generate preview'})).toBeEnabled();await staff.getByRole('button',{name:'Generate preview'}).click();
 await check(staff.locator('img.flyer-preview')).toBeVisible();
 const pdfDownload=staff.waitForEvent('download');await staff.getByRole('button',{name:'Download PDF'}).click();await (await pdfDownload).saveAs(dir+'/operational-workshop.pdf');
 await staff.goto(base+'/admin/workspaces/events?id='+event.id);await staff.getByRole('button',{name:'Publish saved event',exact:true}).click();
 await staff.goto(base+'/admin/workspaces/flyers?id='+event.id);await staff.getByRole('button',{name:'Generate preview',exact:true}).click();await check(staff.locator('img.flyer-preview')).toBeVisible();
 const memberPngDownload=staff.waitForEvent('download');await staff.getByRole('button',{name:'Download PNG',exact:true}).click();await (await memberPngDownload).saveAs(dir+'/member-workshop-published.png');
 const memberPdfDownload=staff.waitForEvent('download');await staff.getByRole('button',{name:'Download PDF',exact:true}).click();await (await memberPdfDownload).saveAs(dir+'/member-workshop-published.pdf');
 const png=PNG.sync.read(await readFile(dir+'/member-workshop-published.png'));assert.equal(png.width,1080);assert.equal(png.height,1350);assert.equal(jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data,base+'/member/events?eventId='+event.id);
 pass('Published member flyer PNG/PDF export and registration QR destination verified');
 await staff.goto(base+'/admin/workspaces/events?id='+event.id);
 const engagement=staff.locator('.event-engagement');
 await engagement.getByText('Event promotion',{exact:true}).click();
 await engagement.getByRole('checkbox',{name:'Registration open',exact:true}).check();
 await engagement.getByRole('button',{name:'Save promotion settings',exact:true}).click();
 await check(engagement.locator('[aria-live=polite]')).toContainText('Promotion settings saved');
 await engagement.getByRole('button',{name:'Review saved promotion',exact:true}).click();
 await check(engagement.getByRole('button',{name:'Approve saved promotion schedule',exact:true})).toBeVisible();
 await engagement.getByRole('button',{name:'Approve saved promotion schedule',exact:true}).click();
 await check(engagement.locator('[aria-live=polite]')).toContainText('Saved promotion approved');
 await communications(event.id,'promotion');
 await member.goto(base+'/member/events?eventId='+event.id);const card=member.locator('article').filter({has:member.getByRole('heading',{name:title,exact:true})});
 await card.getByRole('button',{name:'Reserve place'}).click();await check(card.getByText(/^Payment pending/)).toBeVisible();
 await card.getByLabel('Payment reference',{exact:true}).fill('UI-UPI-750');await card.getByRole('button',{name:'Submit payment reference'}).click();
 await check(member.getByText('Payment reference submitted for staff verification.',{exact:true})).toBeVisible();
 await staff.goto(base+'/admin/workspaces/payments');const paymentRow=staff.locator('tr').filter({hasText:title});await paymentRow.getByRole('button',{name:'Review payment'}).click();
 await staff.getByLabel('Bank / payment reference').fill('UI-UPI-750');await staff.getByLabel('Verification note').fill('Matched workshop payment statement');staff.once('dialog',d=>d.accept());await staff.getByRole('button',{name:'Confirm status change'}).click();
 await member.reload();await check(card).toContainText('Registration confirmed');
 pass('Administrator creates/configures/exports/publishes/reviews promotion; member books/submits reference; staff verifies through UI');
 await communications(event.id,'reminder');
 // Time progression is the only database fixture operation in this UI lifecycle.
 await db.query("UPDATE tpa.events SET starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',version=version+1 WHERE id=$1",[event.id]);
 await staff.goto(base+'/admin/workspaces/events?id='+event.id);
 // Wait for the initial overview response to commit before selecting attendees.
 // That response intentionally resets selections for the newly loaded version.
 await check(staff.getByRole('region',{name:'Event command center'}).getByText(/^Received /)).toBeVisible();
 const attendance=staff.locator('#event-attendance');await attendance.locator('summary').first().click();await attendance.getByRole('checkbox',{name:/^member 2/}).check();await attendance.getByLabel('Correction note').fill('Workshop attendance desk record');
 await attendance.getByRole('button',{name:'Mark selected attended',exact:true}).click();await check(staff.getByRole('region',{name:'Event command center'}).locator('[data-operation-message]').first()).toContainText('Saved');
 await attendance.getByRole('button',{name:'Finalize attendance and mark remaining confirmed registrants absent'}).click();
 const financials=staff.locator('#event-financials');await financials.locator('summary').first().click();
 const expense=financials.locator('form');await expense.getByLabel('Description',{exact:true}).fill('Auditorium rental');await expense.getByLabel('Date',{exact:true}).fill('2026-10-12');await expense.getByLabel('Amount (₹)',{exact:true}).fill('250');await expense.getByRole('button',{name:'Save expense',exact:true}).click();
 await check(financials).toContainText('₹500.00');
 // Upload usable artifacts through the existing resource form.
 const doc=new jsPDF();doc.text('TPA Workshop Presentation and Follow-up',20,20);const bytes=Buffer.from(doc.output('arraybuffer'));
 await writeFile(dir+'/workshop-resource.pdf',bytes);
 await staff.locator('#event-resources > summary').click();
 const resources=staff.locator('.event-engagement');const resourceDetails=resources.locator('details').filter({hasText:'Event resources'}).first();await resourceDetails.locator('summary').first().click();
 for(const [type,title] of [['presentation','Workshop presentation'],['photos','Workshop photos'],['report','Workshop report'],['other','Workshop reading resource']]) {
  await resourceDetails.locator('select').first().selectOption('');await resourceDetails.getByLabel('Resource title').fill(title);await resourceDetails.getByLabel('Resource type').selectOption(type);await resourceDetails.getByLabel('Resource eligibility').selectOption('attended');await resourceDetails.getByLabel('Resource publication').selectOption('published');
  const data=type==='photos'?Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'):bytes;
  await resourceDetails.getByLabel('PDF, JPEG or PNG · up to 5 MB').setInputFiles({name:type==='photos'?'workshop.png':'workshop.pdf',mimeType:type==='photos'?'image/png':'application/pdf',buffer:data});
  await resourceDetails.getByRole('button',{name:'Upload resource',exact:true}).click();await check(resources.locator('[aria-live=polite]')).toContainText('Event resource saved');
 }
 await attendance.getByRole('checkbox',{name:'I reviewed receipts, refunds, pending amounts and expenses.'}).check();await attendance.getByRole('button',{name:'Complete event',exact:true}).click();
 await member.reload();await check(card).toContainText('Attendance');await check(card).toContainText('badge');
 await check(member.getByRole('link',{name:'Workshop presentation',exact:true}).first()).toBeVisible();
 const download=member.waitForEvent('download');await member.getByRole('link',{name:'Workshop presentation',exact:true}).first().click();await (await download).saveAs(dir+'/member-presentation.pdf');
 await member.screenshot({path:dir+'/member-completed-workshop.png',fullPage:true});await staff.screenshot({path:dir+'/admin-completed-workshop.png',fullPage:true});
 assert.deepEqual(errors,[]);pass('UI attendance, expenses, four resource uploads, completion, badge, member history and authorized download');
 await memberContext.close();await staffContext.close();
}
