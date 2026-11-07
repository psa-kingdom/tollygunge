import {expect,type Browser} from '@playwright/test';
import type {Pool} from 'pg';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export async function verifyPaymentTable(browser:Browser,base:string,cookie:string,db:Pool,dir:string){
 const context=await browser.newContext();await context.addCookies([{name:'better-auth.session_token',value:cookie,url:base}]);const page=await context.newPage();const states=[];
 try{
  // A dedicated unpaid fixture keeps this responsive check independent of prior approvals.
  const user=(await db.query('SELECT r.user_id,e.updated_by FROM tpa.event_registrations r JOIN tpa.events e ON e.id=r.event_id LIMIT 1')).rows[0];expect(user).toBeTruthy();
  const long={user_id:user.user_id,event_id:randomUUID()};
  await db.query("INSERT INTO tpa.events(id,title,description,location,starts_at,ends_at,capacity,fee_paise,status,updated_by) VALUES($1,'Responsive collection fixture','Synthetic table fixture','Test hall',now()+interval '3 days',now()+interval '3 days 1 hour',10,75000,'published',$2)",[long.event_id,user.updated_by]);
  await db.query("INSERT INTO tpa.event_registrations(id,event_id,user_id,status,fee_paise,payment_status) VALUES($1,$2,$3,'registered',75000,'pending')",[randomUUID(),long.event_id,user.user_id]);
  await db.query('UPDATE public."user" SET name=$2 WHERE id=$1',[long.user_id,'Synthetic member with a deliberately long professional name for collection roster readability']);
  const count=(await db.query('SELECT count(*)::int n FROM tpa.finance_entries')).rows[0].n;
  for(const width of [320,390,768])for(const colorScheme of ['light','dark'] as const){
   await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});await page.goto(base+'/admin/workspaces/payments/events/'+long.event_id);
   await page.getByRole('tab',{name:'Participant collections',exact:true}).click();
   const region=page.getByRole('region',{name:'Participant fee collections',exact:true}),table=region.getByRole('table');await expect(table.locator('tbody tr').first()).toBeVisible();
   const button=table.getByRole('button',{name:'Add fee collection',exact:true}).first();
   await expect(button).toBeVisible();
   await region.focus();await region.evaluate(e=>{e.scrollLeft=0;});await page.keyboard.press('ArrowRight');await expect(region).toBeFocused();
   const geometry=await region.evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth+1}));expect(geometry.pageOverflow).toBe(false);
   if(geometry.scroll>geometry.client)await expect.poll(()=>region.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
   const keyboardScrollLeft=await region.evaluate(e=>e.scrollLeft);
   await button.click();await expect(page.getByRole('button',{name:'Submit to super admin',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Close collection form',exact:true}).click();
   await expect(page.getByRole('button',{name:'Submit to super admin',exact:true})).toHaveCount(0);
   await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
   const accessibility=await page.evaluate(async()=>{const axe=(window as unknown as {axe:{run:(scope:unknown,options:unknown)=>Promise<{violations:unknown[];incomplete:unknown[]}>}}).axe;const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return {violations:r.violations,incomplete:r.incomplete.length};});expect(accessibility.violations).toEqual([]);
   await page.screenshot({path:`${dir}/payment-table-${width}-${colorScheme}.png`,fullPage:true});states.push({width,colorScheme,...geometry,keyboardScrollLeft,collectionFormDismissed:true,accessibility});
  }
  expect((await db.query('SELECT count(*)::int n FROM tpa.finance_entries')).rows[0].n).toBe(count);
  await page.goto(base+'/admin/workspaces/payments');await page.getByRole('searchbox',{name:'Search events by name',exact:true}).fill('No matching synthetic event');
  await expect(page.getByText('No events match your search and filters.',{exact:true})).toBeVisible();
  return {states,emptyStateVerified:true,confirmationWrites:0};
 }finally{await context.close();}
}
