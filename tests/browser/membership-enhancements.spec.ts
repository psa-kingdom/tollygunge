import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { initialFields } from "../../src/domain/verification";
let bundle: string;
let fixtureCss: string;
test.beforeAll(async () => {
  const result = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ApplicationDraft} from './src/components/application-draft'; import styles from './src/components/portal-theme.module.css'; createRoot(document.getElementById('root')).render(<div className={styles.portal}><ApplicationDraft name="Sample Member" userId="synthetic" /></div>);`, resolveDir: process.cwd(), loader: "tsx" }, outfile: "fixture.js", bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "navigation-fixture", setup(b) { b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" })); b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'export const useRouter=()=>({push:()=>{},refresh:()=>{}});', loader: "js" })); } }] });
  fixtureCss = result.outputFiles.find(file => file.path.endsWith(".css"))!.text;
  bundle = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
});
test("personal photo, gender, review labels and mandatory drawn signature", async ({ page }) => {
  page.on("pageerror", error => console.error(error.message));
  let draft = { version: 1, plan: "Life", category: "Professional", details: { fullName: "Sample Member", qualification: "CA", professionalStatus: "In Practice", phone: "9876543210", photograph: "11111111-1111-4111-8111-111111111111", declaration: "true" } as Record<string,string>, documentIds: [], step: 1 };
  let signatureSaved = false;
  await page.route("http://membership.test/**", route => route.fulfill({ contentType: "text/html", body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main style="max-width:1100px;margin:auto;padding:20px"><div id="root"></div></main></body></html>' }));
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/member/application") {
      if (route.request().method() === "POST") draft = { ...route.request().postDataJSON(), version: draft.version + 1 };
      return route.fulfill({ json: draft });
    }
    if (path === "/api/member/verification") return route.fulfill({ json: { policy: {version:2,fields:initialFields}, email:"sample@example.test",emailVerified:true,verified:false,updateRequested:false,missing:[],reviews:[] } });
    if (path === "/api/member/profile") return route.fulfill({ json: { person: { draft: { name:"Sample Member",phone:"9876543210",organization:"" } } } });
    if (path === "/api/documents" && route.request().method() === "POST") {
      signatureSaved = true; draft.details.signatureDocument = "22222222-2222-4222-8222-222222222222"; draft.version++;
      return route.fulfill({ status:201,json:{id:draft.details.signatureDocument} });
    }
    if (path === "/api/documents") return route.fulfill({ json: [{id:draft.details.photograph,content_type:"image/png"},{id:draft.details.signatureDocument,content_type:"image/png"}] });
    return route.fulfill({ contentType:"image/png",body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=","base64") });
  });
  await page.goto("http://membership.test/");
  for (const file of ["globals.css","premium.css","v3.css","public-ui.css"]) await page.addStyleTag({content:await readFile(`src/app/${file}`,"utf8")});
  await page.addStyleTag({content:fixtureCss});
  await page.addScriptTag({ content: bundle });
  await expect(page.getByLabel("Gender",{exact:false})).toBeVisible();
  await page.getByLabel("Gender",{exact:false}).selectOption("Transgender");
  await expect(page.getByText("Recent photograph *",{exact:true})).toBeVisible();
  await expect(page.getByText("Passport photograph",{exact:false})).toHaveCount(0);
  await page.getByRole("button",{name:"Review & declaration",exact:true}).click();
  await expect(page.getByRole("button",{name:"Submit for profile verification"})).toBeDisabled();
  await expect(page.getByRole("img",{name:"Recent photograph",exact:true})).toBeVisible();
  await expect(page.getByText("Gender",{exact:true}).first()).toHaveCSS("font-weight",/700|800|900/);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", {name:"Download form to sign",exact:true}).click();
  expect((await downloadPromise).suggestedFilename()).toBe("tpa-membership-declaration.pdf");
  const canvas=page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box=(await canvas.boundingBox())!;
  await page.mouse.move(box.x+20,box.y+30); await page.mouse.down(); await page.mouse.move(box.x+110,box.y+65,{steps:8}); await page.mouse.up();
  await page.getByRole("button",{name:"Save signature",exact:true}).click();
  await expect(page.getByRole("button",{name:"Submit for profile verification"})).toBeEnabled();
  expect(signatureSaved).toBe(true);
  await page.screenshot({path:`output/playwright/membership-enhancements/${test.info().project.name}-review.png`,fullPage:true});
});
