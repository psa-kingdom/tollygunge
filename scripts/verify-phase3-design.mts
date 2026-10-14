/** Complete rendered-route visual audit. Refuses non-disposable databases. */
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { chromium } from '@playwright/test';
import { staffNavigation } from '../src/domain/staff-navigation';
import { sitePages } from '../src/domain/site-pages';
const url=new URL(process.env.DATABASE_URL??'');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55439');
assert.ok(url.pathname.startsWith('/tpa_onboarding_test_'));
const base=process.env.TPA_TEST_URL!;assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const db=new Pool({connectionString:url.href,ssl:false});
const output=resolve('.local/phase3/routes-'+new URL(base).port);await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
type Entry={path:string;source:string;actor:'anonymous'|'member'|'administrator';state:string};
const routes:Entry[]=[];
function add(path:string,source:string,actor:Entry['actor']='anonymous',state='rendered'){routes.push({path,source,actor,state});}
const cookies:Partial<Record<Entry['actor']|'limited',string>>={};
const results:unknown[]=[];const failures:unknown[]=[];const authorization:unknown[]=[];
async function fixture(role:string){
 const id=randomUUID(),token=randomBytes(24).toString('hex');
 await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',[id,'Phase 3 '+role,id+'@example.invalid']);
 if(role!=='member')await db.query('INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,$2)',[id,role]);
 await db.query('INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'2 hours\',now())',[randomUUID(),token,id]);
 const signed=encodeURIComponent(token+'.'+createHmac('sha256',process.env.BETTER_AUTH_SECRET!).update(token).digest('base64'));
 return {id,signed};
}
try{
 const admin=await fixture('administrator');cookies.administrator=admin.signed;
 cookies.member=(await fixture('member')).signed;cookies.limited=(await fixture('event_operator')).signed;
 const event=randomUUID(),flyer=randomUUID(),content=randomUUID(),slug='phase-three-'+randomBytes(6).toString('hex');
 await db.query("INSERT INTO tpa.events(id,title,description,location,starts_at,ends_at,capacity,status,updated_by) VALUES($1,'Professional learning in Kolkata','A synthetic event for isolated responsive acceptance.','Tollygunge, Kolkata',now()+interval '5 days',now()+interval '5 days 2 hours',100,'published',$2)",[event,admin.id]);
 await db.query("INSERT INTO tpa.flyer_variants(id,event_id,name,status,updated_by) VALUES($1,$2,'Acceptance flyer','published',$3)",[flyer,event,admin.id]);
 const body={title:'Professional perspectives',intro:'Isolated editorial acceptance content.',sections:[{title:'Shared knowledge',text:'A long professional perspective for responsive reading.'}],sourceUrl:'',attribution:''};
 await db.query("INSERT INTO tpa.content_entries(id,slug,kind,draft,published,updated_by) VALUES($1,$2,'insight',$3,$3,$4)",[content,slug,body,admin.id]);
 add('/','src/app/page.tsx');
 for(const slug of Object.keys(sitePages))add('/'+slug,'src/app/[page]/page.tsx');
 for(const path of ['join','signup','login','invitation','email-verification','forgot-password','reset-password','unsubscribe'])add('/'+path,`src/app/${path}/page.tsx`,'anonymous',/invitation|verification|reset|unsubscribe/.test(path)?'missing-link recovery':'rendered');
 add('/events/'+event,'src/app/events/[id]/page.tsx');add('/flyers/'+flyer,'src/app/flyers/[id]/page.tsx');add('/resources/'+slug,'src/app/resources/[slug]/page.tsx');
 for(const path of ['','application','events','inquiries','payments','security'])add('/member'+(path?'/'+path:''),`src/app/member/${path?path+'/':''}page.tsx`,'member');
 add('/account/profile','src/app/account/profile/page.tsx','member');add('/account','src/app/account/page.tsx','member','redirect to member');add('/account','src/app/account/page.tsx','administrator','redirect to admin');
 add('/admin','src/app/admin/page.tsx','administrator');
 for(const item of staffNavigation(['administrator']).flatMap(group=>group.items).filter(item=>item.href!=='/admin'))add(item.href,'src/app/admin/workspaces/[workspace]/page.tsx','administrator');
 add('/admin/content/'+content,'src/app/admin/content/[id]/page.tsx','administrator');add('/account/profile','src/app/account/profile/page.tsx','administrator','staff account shell');
 add('/preview/admin','src/app/preview/admin/page.tsx');
 for(const workspace of ['events','content','crm','communications','payments'])add('/preview/admin/workspaces/'+workspace,'src/app/preview/admin/workspaces/[workspace]/page.tsx');
 for(const path of ['/missing/route/phase-three','/events/not-a-uuid','/events/'+randomUUID(),'/flyers/'+randomUUID(),'/resources/missing-phase-three'])add(path,'src/components/fallback-screen.tsx','anonymous','not found');
 add('/admin/workspaces/unknown','src/app/admin/workspaces/[workspace]/page.tsx','administrator','not found');add('/admin/content/'+randomUUID(),'src/app/admin/content/[id]/page.tsx','administrator','not found');
 const covered=new Set(routes.map(route=>route.source));
 const pages: string[]=[];
 async function scan(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory())await scan(path);else if(entry.name==='page.tsx')pages.push(path);}}
 await scan('src/app');assert.deepEqual(pages.filter(path=>!covered.has(path)),[],'Every filesystem page must be inventoried');
 await writeFile(output+'/inventory.json',JSON.stringify({routes,filesystemPages:pages},null,2));
 await Promise.all((['anonymous','member','administrator'] as const).map(async actor=>{
  const context=await browser.newContext();if(cookies[actor])await context.addCookies([{name:'better-auth.session_token',value:cookies[actor]!,url:base}]);
  const page=await context.newPage();
  for(const mode of ['light','dark'] as const){await page.emulateMedia({colorScheme:mode,reducedMotion:'reduce'});
   for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:width<=390?844:1000});
    for(const [index,route] of routes.entries()){if(route.actor!==actor)continue;
     const errors:string[]=[],failedAssets:string[]=[];const listener=(e:Error)=>errors.push(e.message);page.on('pageerror',listener);
     const assetListener=(response:import('@playwright/test').Response)=>{if(response.status()>=400&&['image','font','stylesheet','script'].includes(response.request().resourceType()))failedAssets.push(response.url());};page.on('response',assetListener);
     const response=await page.goto(base+route.path,{waitUntil:'networkidle',timeout:45000});
     await page.evaluate(()=>document.fonts.ready);
     await page.addScriptTag({path:resolve('.local/technical-qa/node_modules/axe-core/axe.min.js')});
     const issues=await page.evaluate(async()=>{
      const violations=(await (window as unknown as {axe:{run:(options:unknown)=>Promise<{violations:{id:string;nodes:{target:string[]}[]}[]}>}}).axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));
      // Unrequested lazy images in the closed atlas are covered by its separate
      // open/interaction acceptance; absence of currentSrc is not an asset error.
      return {overflow:document.documentElement.scrollWidth>innerWidth+1,brokenImages:Array.from(document.images).filter(i=>i.currentSrc&&i.complete&&!i.naturalWidth).map(i=>i.currentSrc),violations};
     });
     const status=response?.status();const expected404=route.state==='not found';
     await page.screenshot({path:output+`/${actor}-${index}-${width}-${mode}.png`,fullPage:true});
     const result={...route,width,mode,status,errors,failedAssets,...issues};results.push(result);
     if(issues.overflow||issues.brokenImages.length||failedAssets.length||issues.violations.length||errors.length||(!expected404&&status!==200)||(expected404&&![200,404].includes(status??0)))failures.push(result);
     page.off('pageerror',listener);page.off('response',assetListener);
    }
   }
  }await context.close();console.log('Audited '+actor+' routes');
 }));
 for(const actor of ['anonymous','member','limited'] as const){
  const context=await browser.newContext();if(cookies[actor])await context.addCookies([{name:'better-auth.session_token',value:cookies[actor]!,url:base}]);
  const page=await context.newPage();
  for(const path of ['/admin','/admin/workspaces/access','/admin/workspaces/payments','/admin/content/'+content]){
   const response=await page.goto(base+path,{waitUntil:'networkidle'});const target=new URL(page.url()).pathname;
   const forbidden=actor==='anonymous'?target==='/login':actor==='member'?target==='/member':path==='/admin'?target==='/admin':await page.getByRole('heading',{name:'A little off the beaten path.'}).isVisible();
   authorization.push({actor,path,status:response?.status(),target,passed:forbidden});assert.ok(forbidden,actor+' '+path);
  }await context.close();
 }
 assert.equal(failures.length,0,'See .local/phase3/routes/results.json for visual/a11y failures');
}finally{
 await browser.close();await db.end();
 await writeFile(output+'/results.json',JSON.stringify({buildId:(await readFile('.next/BUILD_ID','utf8')).trim(),results,failures,authorization},null,2));
 console.log(JSON.stringify({states:results.length,failures:failures.length,authorizationChecks:authorization.length}));
}
