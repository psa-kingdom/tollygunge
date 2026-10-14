import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import type { FlyerEvent } from "../src/lib/flyer-canvas";
import type { Speaker } from "../src/domain/event-flow";
const bundle=await build({entryPoints:["src/lib/flyer-canvas.ts"],bundle:true,write:false,platform:"browser",format:"iife",globalName:"Flyer",define:{"process.env.NODE_ENV":'"production"'}});
const browser=await chromium.launch({channel:process.env.TPA_BROWSER_CHANNEL || "chrome"});
const dir=".local/flyer-layout/"+new Date().toISOString().replaceAll(":","-");
const event:FlyerEvent={id:"00000000-0000-4000-8000-000000000001",title:"Community learning workshop",location:"Tollygunge association auditorium",starts_at:"2026-12-12T12:00:00Z",fee_paise:75000,visibility:"public",registration_starts_at:null,registration_ends_at:null};
const target="https://example.invalid/events/"+event.id;
try {
  await mkdir(dir,{recursive:true});const page=await browser.newPage();await page.setContent("<main></main>");await page.addScriptTag({content:bundle.outputFiles[0].text});
  for(const count of [1,2,3,6]) {
    const speakers=Array.from({length:count},(_,i)=>({name:`Dr. Speaker ${i+1}`,credentials:"Professor of professional practice and community education"}));
    if(count===6)speakers[5]={name:("Dr. "+"Longspeakername".repeat(4)).slice(0,60),credentials:"A".repeat(120)};
    const result=await page.evaluate(async ({event,speakers,target})=>(window as unknown as {Flyer:{renderFlyer:(event:FlyerEvent,speakers:Speaker[],target:string)=>Promise<string>}}).Flyer.renderFlyer(event,speakers,target),{event,speakers,target});
    const bytes=Buffer.from(result.split(",")[1],"base64"),png=PNG.sync.read(bytes);assert.equal(png.width,1080);assert.equal(png.height,1350);assert.equal(jsQR(new Uint8ClampedArray(png.data),1080,1350)?.data,target);
    await writeFile(`${dir}/flyer-${count}-speakers.png`,bytes);console.log(`PASS: ${count} speakers; full metadata and decoded QR`);
  }
  console.log("Evidence: "+dir);
} finally {await browser.close();}
