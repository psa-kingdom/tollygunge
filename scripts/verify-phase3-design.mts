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
const phase4=process.argv.includes('--phase4'),scout=process.argv.includes('--scout'),tableRefinement=process.argv.includes('--table-refinement');
const widths=phase4?(scout?[1920,1024,320]:[1920,1440,1280,1024,768,430,390,360,320]):[1440,1024,768,390,320];
const output=resolve(`.local/${phase4?'phase4':'phase3'}/routes-`+new URL(base).port);await mkdir(output,{recursive:true});
const resumeIndex=process.argv.indexOf('--resume-from');
const resumeDirectory=resumeIndex<0?null:process.argv[resumeIndex+1];
assert.ok(resumeIndex<0||(phase4&&resumeDirectory),'Resume is Phase 4 only and requires an evidence directory');
const previous=resumeDirectory?JSON.parse(await readFile(resolve(resumeDirectory,'results.json'),'utf8')):null;
const previousInventory=resumeDirectory?JSON.parse(await readFile(resolve(resumeDirectory,'inventory.json'),'utf8')):null;
if(previous){assert.equal(previous.buildId,(await readFile('.next/BUILD_ID','utf8')).trim());assert.deepEqual(previous.failures,[]);}
const browser=await chromium.launch({channel:'chrome',headless:true});
type Entry={path:string;source:string;actor:'anonymous'|'member'|'administrator';state:string};
const routes:Entry[]=[];
function add(path:string,source:string,actor:Entry['actor']='anonymous',state='rendered'){routes.push({path,source,actor,state});}
const cookies:Partial<Record<Entry['actor']|'limited',string>>={};
const overlays:unknown[]=[];
const results:unknown[]=[];const failures:unknown[]=[];const authorization:unknown[]=[];
async function fixture(role:string){
 const id=randomUUID(),token=randomBytes(24).toString('hex');
 await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',[id,phase4?'Phase 4 '+role+' — Professional Standards and Community Development':'Phase 3 '+role,(phase4?'a.long.professional.account.address.':'')+id+'@example.invalid']);
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
 if(previousInventory)assert.deepEqual(routes.map(({source,actor,state})=>({source,actor,state})),previousInventory.routes.map(({source,actor,state}:Entry)=>({source,actor,state})),'Resume requires the same route inventory and build');
 const covered=new Set(routes.map(route=>route.source));
 const pages: string[]=[];
 async function scan(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory())await scan(path);else if(entry.name==='page.tsx')pages.push(path);}}
 await scan('src/app');assert.deepEqual(pages.filter(path=>!covered.has(path)),[],'Every filesystem page must be inventoried');
 await writeFile(output+'/inventory.json',JSON.stringify({routes,filesystemPages:pages},null,2));
 await Promise.all((['anonymous','member','administrator'] as const).map(async actor=>{
  const context=await browser.newContext();if(cookies[actor])await context.addCookies([{name:'better-auth.session_token',value:cookies[actor]!,url:base}]);
  const page=await context.newPage();
  for(const mode of ['light','dark'] as const){await page.emulateMedia({colorScheme:mode,reducedMotion:'reduce'});
   for(const width of widths){await page.setViewportSize({width,height:width<=430?844:width===1920?1080:1000});
    for(const [index,route] of routes.entries()){if(route.actor!==actor)continue;
     if(tableRefinement&&!['/preview/admin','/admin/workspaces/verification'].includes(route.path)&&!route.path.startsWith('/preview/admin/workspaces/'))continue;
     if(scout&&!['/','/about','/login','/signup','/reset-password','/member','/member/application','/member/events','/account/profile','/admin','/admin/workspaces/members','/admin/workspaces/events','/admin/workspaces/payments','/admin/workspaces/reports','/admin/workspaces/website','/preview/admin','/missing/route/phase-three'].includes(route.path))continue;
     const prior=previous?.results.find((r:Entry&{width:number;mode:string;routeCaseIndex?:number})=>r.width===width&&r.mode===mode&&(r.routeCaseIndex??previousInventory.routes.findIndex((old:Entry)=>old.path===r.path&&old.actor===r.actor&&old.state===r.state))===index);
     if(prior){results.push({...prior,routeCaseIndex:index,evidenceDirectory:prior.evidenceDirectory??resumeDirectory,resumed:true});continue;}
     const errors:string[]=[],failedAssets:string[]=[];const listener=(e:Error)=>errors.push(e.message);page.on('pageerror',listener);
     const assetListener=(response:import('@playwright/test').Response)=>{if(response.status()>=400&&['image','font','stylesheet','script'].includes(response.request().resourceType()))failedAssets.push(response.url());};page.on('response',assetListener);
     const response=await page.goto(base+route.path,{waitUntil:'networkidle',timeout:45000});
     await page.evaluate(()=>document.fonts.ready);
     await page.addScriptTag({path:resolve('.local/technical-qa/node_modules/axe-core/axe.min.js')});
     const issues=await page.evaluate(async()=>{
      const violations=(await (window as unknown as {axe:{run:(options:unknown)=>Promise<{violations:{id:string;nodes:{target:string[]}[]}[]}>}}).axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));
      // Unrequested lazy images in the closed atlas are covered by its separate
      // open/interaction acceptance; absence of currentSrc is not an asset error.
      return {collapsedTables:Array.from(document.querySelectorAll('.workspace-main .table-wrap table')).filter(t=>t.getBoundingClientRect().width<559).length,overflow:document.documentElement.scrollWidth>innerWidth+1,brokenImages:Array.from(document.images).filter(i=>i.currentSrc&&i.complete&&!i.naturalWidth).map(i=>i.currentSrc),violations};
     });
     if(tableRefinement&&width===320&&route.path==='/preview/admin'){
      const scroller=page.getByRole('region',{name:'Preview membership applications'});await scroller.focus();await page.keyboard.press('ArrowRight');
      await page.waitForFunction(()=>document.querySelector('.table-wrap')!.scrollLeft>0);assert.ok(await scroller.evaluate(el=>el.scrollWidth>el.clientWidth));
      await scroller.evaluate(el=>{el.scrollLeft=0;});await page.evaluate(()=>window.scrollTo(0,0));
     }
     const status=response?.status();const expected404=route.state==='not found';
     await page.screenshot({path:output+`/${actor}-${index}-${width}-${mode}.png`,fullPage:true,timeout:60000});
     const result={...route,routeCaseIndex:index,evidenceDirectory:output,width,mode,status,errors,failedAssets,...issues};results.push(result);
     if(issues.collapsedTables||issues.overflow||issues.brokenImages.length||failedAssets.length||issues.violations.length||errors.length||(!expected404&&status!==200)||(expected404&&![200,404].includes(status??0)))failures.push(result);
     page.off('pageerror',listener);page.off('response',assetListener);
    }
   }
  }await context.close();console.log('Audited '+actor+' routes');
 }));
 if(phase4&&!scout&&!tableRefinement){
  for(const actor of ['anonymous','member','administrator'] as const){
   const context=await browser.newContext();if(cookies[actor])await context.addCookies([{name:'better-auth.session_token',value:cookies[actor]!,url:base}]);
   const page=await context.newPage();const path=actor==='anonymous'?'/login':actor==='member'?'/account/profile':'/admin';
   for(const mode of ['light','dark'] as const)for(const width of widths){
    await page.setViewportSize({width,height:width<=430?844:1000});await page.emulateMedia({colorScheme:mode,reducedMotion:'no-preference'});
    await page.goto(base+path,{waitUntil:'networkidle'});
    const trigger=page.getByRole('button',{name:actor==='anonymous'?'Appearance settings':'Account menu',exact:true});
    await trigger.click();const panel=page.locator('.account-menu');await panel.waitFor();await panel.evaluate(async el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
    const bounds=await panel.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,clientWidth:document.documentElement.clientWidth,height:innerHeight,animation:getComputedStyle(el).animationDuration};});
    assert.ok(bounds.left>=4&&bounds.right<=bounds.clientWidth-4&&bounds.bottom<=bounds.height,JSON.stringify(bounds));
    await page.screenshot({path:output+`/overlay-${actor}-${width}-${mode}.png`});
    await page.addScriptTag({path:resolve('.local/technical-qa/node_modules/axe-core/axe.min.js')});
    const overlayViolations=await page.evaluate(async()=> (await (window as unknown as {axe:{run:(options:unknown)=>Promise<{violations:unknown[]}>}}).axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
    assert.deepEqual(overlayViolations,[]);assert.equal(bounds.animation,'0.18s');
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await panel.evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.ok(await trigger.evaluate(el=>el===document.activeElement));
    overlays.push({actor,path,width,mode,kind:'account',bounds,focusReturn:true,liveReducedMotion:true,violations:overlayViolations});
    if(actor==='anonymous'&&width<=768){
     const navigation=page.locator('.mobile-nav');await navigation.locator(':scope > summary').press('Enter');
     const menu=navigation.locator('nav');await menu.waitFor();
     const bounds=await menu.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,clientWidth:document.documentElement.clientWidth,headerBottom:document.querySelector('.site-header')!.getBoundingClientRect().bottom};});
     assert.ok(bounds.left>=4&&bounds.right<=bounds.clientWidth-4&&bounds.top>=bounds.headerBottom);
     await menu.locator('summary').filter({hasText:/^Membership$/}).press('Enter');
     assert.ok(await menu.getByRole('link',{name:'Why Become a Member',exact:true}).isVisible());
     await page.screenshot({path:output+`/navigation-${width}-${mode}.png`});
     await navigation.locator(':scope > summary').press('Enter');
     overlays.push({actor,path,width,mode,kind:'navigation',bounds});
    }
    if(actor==='administrator'){
     await page.emulateMedia({reducedMotion:'no-preference'});
     const search=page.getByRole('button',{name:/Search workspace/});await search.click();
     const dialog=page.locator('.command-dialog[open]');await dialog.waitFor();await dialog.evaluate(async el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
     assert.ok(await page.locator('#workspace-search').evaluate(el=>el===document.activeElement));
     const rect=await dialog.boundingBox();assert.ok(rect&&rect.x>=0&&rect.x+rect.width<=width&&rect.y>=0);
     await page.screenshot({path:output+`/search-${width}-${mode}.png`});
     await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await dialog.evaluate(el=>getComputedStyle(el).animationName),'none');
     await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.ok(await search.evaluate(el=>el===document.activeElement));
     overlays.push({actor,path,width,mode,kind:'search',bounds:rect,focusReturn:true,liveReducedMotion:true});
    }
   }await context.close();
  }
 }
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
 await writeFile(output+'/results.json',JSON.stringify({buildId:(await readFile('.next/BUILD_ID','utf8')).trim(),results,failures,authorization,overlays,resumeDirectory},null,2));
 console.log(JSON.stringify({states:results.length,failures:failures.length,authorizationChecks:authorization.length}));
}
