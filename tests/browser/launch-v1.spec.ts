import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../../src/lib/database-options";
test.beforeEach(() => test.skip(!process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"), "Disposable local fixture required."));

test("public release metadata, robots, privacy and meaningful single headings are present", async ({page, request}) => {
  for (const path of ["/", "/about", "/governance", "/membership", "/events", "/resources", "/contact", "/privacy"]) {
    await page.goto(path); await expect(page.getByRole("heading", {level:1})).toHaveCount(1);
    expect(new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!).href).toBe(new URL(path,"https://tpassociation.org").href);
    expect((await page.locator('meta[name="description"]').getAttribute("content"))!.length).toBeGreaterThan(20);
    expect(new URL((await page.locator('meta[property="og:url"]').getAttribute("content"))!).href).toBe(new URL(path,"https://tpassociation.org").href);
  }
  expect((await request.get("/robots.txt")).status()).toBe(200);
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://tpassociation.org/sitemap.xml");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("https://tpassociation.org/privacy"); expect(sitemap).not.toMatch(/\/(?:member|admin)(?:\/|<)|token=/);
  const image = await request.get("/opengraph-image"); expect(image.status()).toBe(200); expect(image.headers()["content-type"]).toContain("image/png");
  const schema = await (await request.get("/")).text(); expect(schema).toContain('"@type":"Organization"');
  expect((await request.get("/unavailable-synthetic-page")).status()).toBe(404);
});

test("public issue reporting saves one CRM-tagged inquiry and previews only opted-in safe context", async ({page}) => {
  const email = randomUUID() + "@example.invalid";
  await page.goto("/contact?type=issue&from=" + encodeURIComponent("/member/application?token=DO-NOT-SEND"));
  const form = page.locator("form.public-inquiry");
  await form.getByLabel("Full name", {exact:true}).fill("Synthetic issue reporter");
  await form.getByLabel("Email address", {exact:true}).fill(email);
  await form.getByRole("textbox", {name:"Issue details",exact:true}).fill("Expected an available action. The action did not finish. Steps: open the page, select the action, observe the result.");
  await form.getByRole("button", {name:"Preview technical context",exact:true}).click();
  const preview = form.locator(".issue-context-preview"); await expect(preview).toContainText("Page: /member/application"); await expect(preview).not.toContainText("DO-NOT-SEND");
  const optIn = form.getByRole("checkbox",{name:"Include this technical context with my report",exact:true}); await expect(optIn).not.toBeChecked(); await optIn.check();
  await form.getByRole("checkbox", {name:/I agree that TPA may store/}).check();
  await form.getByRole("button", {name:"Send issue report",exact:true}).click();
  await expect(page.getByText("Your inquiry is saved.",{exact:true})).toBeVisible();
  await expect(page.getByText(/^Reference: /)).toBeVisible();
  const db = new Pool(databaseOptions());
  try {
    const rows=(await db.query("SELECT topic,tags,message FROM tpa.inquiries WHERE contact_email=$1",[email])).rows;
    expect(rows).toHaveLength(1); expect(rows[0].topic).toBe("General"); expect(rows[0].tags).toContain("website-issue");
    expect(rows[0].message).toContain("Optional technical context:"); expect(rows[0].message).not.toContain("DO-NOT-SEND");
  } finally {await db.end();}
});

test("member issue reports retain existing status tracking and are tagged for staff triage", async ({page}) => {
  test.skip(!process.env.TPA_UI_MEMBER_EMAIL, "Synthetic member credentials required.");
  await page.goto("/login"); await page.getByLabel("Email",{exact:true}).fill(process.env.TPA_UI_MEMBER_EMAIL!);
  await page.getByLabel("Password",{exact:true}).fill(process.env.TPA_UI_MEMBER_PASSWORD!);
  await page.getByRole("button",{name:"Sign in",exact:true}).click(); await page.waitForURL("**/member");
  await page.getByRole("button",{name:"Account menu",exact:true}).click();
  await page.getByRole("dialog",{name:"Account settings",exact:true}).getByRole("link",{name:"Report an issue",exact:true}).click();
  const subject="Synthetic member issue " + randomUUID().slice(0,8);
  await page.getByLabel("Subject",{exact:true}).fill(subject);
  await page.getByRole("textbox",{name:"Issue details",exact:true}).fill("Expected the action to finish. Actual result: an error was shown. Steps: sign in, open the feature and choose its action.");
  await page.getByRole("button",{name:"Send issue report",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Inquiry saved. Reference:");
  await expect(page.getByRole("heading",{name:"[Website issue] "+subject,exact:true})).toBeVisible();
  const db = new Pool(databaseOptions());
  try {const row=(await db.query("SELECT tags,message FROM tpa.inquiries WHERE subject=$1",["[Website issue] "+subject])).rows[0];expect(row.tags).toContain("website-issue");expect(row.message).not.toContain("Optional technical context:");}
  finally {await db.end();}
});
