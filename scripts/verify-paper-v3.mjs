/* global window, document, innerWidth */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.TPA_V3_QA_URL??'http://127.0.0.1:3168';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Use an explicit loopback preview URL');
const out=process.env.TPA_V3_QA_OUTPUT??'output/playwright/paper-v3-correction';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try { for (const mode of ['light','dark']) for (const width of [320,390,768,1024,1440,1920]) {
 const context=await browser.newContext({viewport:{width,height:width<500?844:1000},colorScheme:mode,reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(async()=>{for(const img of document.images){if(img.getClientRects().length){img.loading='eager';await img.decode().catch(()=>{});}}});
 await page.addScriptTag({path:'.local/technical-qa/node_modules/axe-core/axe.min.js'});
 const a11y=await page.evaluate(async()=>{const r=await window.axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});
 const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,brokenImages:[...document.images].filter(i=>i.getClientRects().length && (!i.complete||!i.naturalWidth)).map(i=>i.src),heroBottom:document.querySelector('.hero').getBoundingClientRect().bottom,heading:document.querySelector('h1').textContent,removedGraphics:document.querySelectorAll('.tpa-atlas,.kolkata-hero-art,.v3-community-art').length,formWidth:document.querySelector('.inquiry-intake').getBoundingClientRect().width,contactWidth:document.querySelector('.contact-intake').getBoundingClientRect().width,formPadding:getComputedStyle(document.querySelector('form.public-inquiry')).padding,formBorder:getComputedStyle(document.querySelector('form.public-inquiry')).borderWidth,sections:[...document.querySelector('main').children].map(e=>e.className)}));
 await page.screenshot({path:`${out}/${mode}-${width}.png`,fullPage:true});
 await page.screenshot({path:`${out}/${mode}-${width}-viewport.png`});
 await page.locator('.inquiry-additional summary').click();
 await page.locator('.contact-intake').screenshot({path:`${out}/${mode}-${width}-inquiry-expanded.png`,style:".site-header,.skip-link{visibility:hidden}"});
 const expandedOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 await page.route('**/api/newsletter/subscribe',async route=>{await new Promise(resolve=>setTimeout(resolve,1200));await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic service unavailable'})});});
 const form=page.locator('form.newsletter-form');await form.getByLabel('Email address',{exact:true}).fill('review@example.invalid');await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Subscribe',exact:true}).click();
 await form.getByRole('button',{name:'Requesting…',exact:true}).waitFor();await page.locator('.newsletter-panel').screenshot({path:`${out}/${mode}-${width}-newsletter-loading.png`,style:".site-header,.skip-link{visibility:hidden}"});
 await form.getByRole('status').filter({hasText:'temporarily unavailable'}).waitFor();
 await page.locator('.newsletter-panel').screenshot({path:`${out}/${mode}-${width}-newsletter-failure.png`,style:".site-header,.skip-link{visibility:hidden}"});
 const retainedEmail=await form.getByLabel('Email address',{exact:true}).inputValue();
 const failureOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 results.push({mode,width,status:response.status(),errors,...layout,a11y,expandedOverflow,failureOverflow,retainedEmail});await context.close();
 }}finally{await browser.close();await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results.map(r=>({mode:r.mode,width:r.width,status:r.status,overflow:r.overflow,broken:r.brokenImages.length,errors:r.errors.length,a11y:r.a11y.length,heroBottom:r.heroBottom})),null,2));
if(results.some(r=>r.overflow||r.expandedOverflow||r.failureOverflow||r.retainedEmail!=='review@example.invalid'||r.errors.length||r.a11y.length||r.brokenImages.length||r.status!==200))process.exitCode=1;
