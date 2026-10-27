import {expect,type Browser} from '@playwright/test';
import type {Pool} from 'pg';
import {resolve} from 'node:path';
export async function verifyPaymentTable(browser:Browser,base:string,cookie:string,db:Pool,dir:string){
 const context=await browser.newContext();await context.addCookies([{name:'better-auth.session_token',value:cookie,url:base}]);const page=await context.newPage();const states=[];
 try{
  const long=(await db.query("SELECT user_id,event_id FROM tpa.event_registrations WHERE payment_status='pending' AND fee_paise>0 LIMIT 1")).rows[0];expect(long).toBeTruthy();
  await db.query('UPDATE public."user" SET name=$2 WHERE id=$1',[long.user_id,'Synthetic member with a deliberately long professional name for payment roster readability']);
  await db.query('UPDATE tpa.events SET title=$2 WHERE id=$1',[long.event_id,'Synthetic professional learning workshop with a deliberately long event title to verify readable responsive payment columns']);
  for(const width of [320,390,768])for(const colorScheme of ['light','dark'] as const){
   await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});await page.goto(base+'/admin/workspaces/payments');
   const table=page.getByRole('table',{name:'Registration payments',exact:true}),region=page.getByRole('region',{name:'Registration payments',exact:true});await expect(table.locator('tbody tr').first()).toBeVisible();
   await page.screenshot({path:`${dir}/payment-table-${width}-${colorScheme}-initial.png`,fullPage:true});
   const button=table.getByRole('button',{name:'Review payment',exact:true}).first();
   const box=await button.boundingBox();expect(box?.width,'Payment action must remain readable').toBeGreaterThanOrEqual(110);expect(box?.height,'Action must not wrap into a vertical column').toBeLessThanOrEqual(80);
   await table.focus();await region.evaluate(e=>{e.scrollLeft=0;});await page.keyboard.press('ArrowRight');await expect(table).toBeFocused();
   const geometry=await region.evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth+1}));expect(geometry.pageOverflow).toBe(false);if(width<768)expect(geometry.scroll).toBeGreaterThan(geometry.client);
   if(geometry.scroll>geometry.client)await expect.poll(()=>region.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
   const keyboardScrollLeft=await region.evaluate(e=>e.scrollLeft);
   await button.click();const form=page.locator('form').filter({has:page.getByRole('button',{name:'Confirm status change',exact:true})});await expect(form).toBeVisible();
   await page.getByLabel('Bank / payment reference',{exact:true}).fill('SYNTHETIC-DISMISS-ONLY');await page.getByLabel('Verification note',{exact:true}).fill('Synthetic confirmation cancelled; no payment write');
   const confirm=form.getByRole('button',{name:'Confirm status change',exact:true});page.once('dialog',d=>d.dismiss());await confirm.click();await expect(confirm).toBeFocused();
   await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});
   const accessibility=await page.evaluate(async()=>{const axe=(window as unknown as {axe:{run:(scope:unknown,options:unknown)=>Promise<{violations:unknown[];incomplete:unknown[]}>}}).axe;const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return {violations:r.violations,incomplete:r.incomplete.length};});expect(accessibility.violations).toEqual([]);
   await page.screenshot({path:`${dir}/payment-table-${width}-${colorScheme}.png`,fullPage:true});states.push({width,colorScheme,...geometry,keyboardScrollLeft,actionWidth:box!.width,actionHeight:box!.height,confirmationDismissed:true,accessibility});
  }
  const counts=(await db.query('SELECT payment_status,count(*) FROM tpa.event_registrations GROUP BY payment_status')).rows;
  const empty=['pending','paid','failed','refunded','cancelled'].find(s=>!counts.some(r=>r.payment_status===s));expect(empty,'Fixture must retain an empty payment status').toBeTruthy();await page.getByRole('region',{name:'Registration payments',exact:true}).locator('..').getByRole('combobox').first().selectOption(empty!);await expect(page.getByText('No payments match this status.',{exact:true})).toBeVisible();
  return {states,emptyStateVerified:true,confirmationWrites:0};
 }finally{await context.close();}
}
