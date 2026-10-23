import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../../src/lib/database-options";
import { openMail } from "../../src/lib/onboarding-mail";
import { publicUnsubscribeToken } from "../../src/lib/public-newsletter";

test.beforeEach(() => test.skip(!process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"), "Requires a disposable local database"));
test("public newsletter requires confirmation without an account and unsubscribes without login", async ({page}, info) => {
  const db=new Pool(databaseOptions()), email=randomUUID()+"@example.invalid";
  try {
    await page.goto("/");const form=page.locator("form.newsletter-form");
    await form.getByLabel("Email address", {exact:true}).fill(email);await form.getByRole("checkbox").check();await form.getByRole("button",{name:"Subscribe",exact:true}).click();
    await expect(form.getByRole("status")).toContainText("subscription starts only after you confirm");
    const row=(await db.query("SELECT * FROM tpa.public_subscribers WHERE email=$1",[email])).rows[0];expect(row.status).toBe("pending");
    expect((await db.query('SELECT 1 FROM public."user" WHERE lower(email)=$1',[email])).rowCount).toBe(0);
    const job=(await db.query("SELECT payload FROM tpa.email_jobs WHERE subscriber_id=$1 AND kind='subscription_confirmation'",[row.id])).rows[0];
    const body=openMail(job.payload.sealedBody);const url=body.split("\n").find((line:string)=>line.startsWith("http"));
    await page.goto(url);await expect(page.getByRole("button",{name:"Confirm subscription",exact:true})).toBeVisible();expect(page.url()).not.toContain("token=");
    expect((await db.query("SELECT status FROM tpa.public_subscribers WHERE id=$1",[row.id])).rows[0].status).toBe("pending");
    await page.getByRole("button",{name:"Confirm subscription",exact:true}).click();await expect(page.getByRole("heading",{level:1})).toHaveText("You’re subscribed.");
    await page.screenshot({path:info.outputPath("subscription-confirmed.png"),fullPage:true});
    const c=await db.connect();let token:string;try{token=await publicUnsubscribeToken(c,row.id,row.version);}finally{c.release();}
    await page.goto(`/newsletter/unsubscribe#token=${token}`);await page.getByRole("button",{name:"Unsubscribe",exact:true}).click();await expect(page.getByRole("heading",{level:1})).toHaveText("You’re unsubscribed.");
    expect((await db.query("SELECT status FROM tpa.public_subscribers WHERE id=$1",[row.id])).rows[0].status).toBe("unsubscribed");
  } finally {await db.end();}
});

test("newsletter failures retain the address and compact inquiry derives the subject",async({page},info)=>{
  await page.goto("/");await page.route("**/api/newsletter/subscribe",route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Synthetic unavailable"})}));
  const newsletter=page.locator("form.newsletter-form");await newsletter.getByLabel("Email address",{exact:true}).fill("synthetic@example.invalid");await newsletter.getByRole("checkbox").check();await newsletter.getByRole("button",{name:"Subscribe",exact:true}).click();await expect(newsletter.getByRole("status")).toContainText("temporarily unavailable");await expect(newsletter.getByLabel("Email address",{exact:true})).toHaveValue("synthetic@example.invalid");
  const inquiryEmail=randomUUID()+"@example.invalid";const form=page.locator("form.public-inquiry");await expect(form.locator("details")).not.toHaveAttribute("open","");
  await form.getByLabel("Full name",{exact:true}).fill("Synthetic Inquiry");await form.getByLabel("Email address",{exact:true}).fill(inquiryEmail);await form.getByLabel("How can we help?",{exact:true}).fill("Please share information about professional membership.");await form.getByRole("checkbox").check();
  await form.getByRole("button",{name:"Send inquiry",exact:true}).click();await expect(page.getByText("Your inquiry is saved.",{exact:true})).toBeVisible();
  const db=new Pool(databaseOptions());try{expect((await db.query("SELECT subject FROM tpa.inquiries WHERE contact_email=$1",[inquiryEmail])).rows[0].subject).toBe("General inquiry");}finally{await db.end();}
  await page.screenshot({path:info.outputPath("compact-inquiry-saved.png"),fullPage:true});
});

test("inquiry optional fields expand without squeezing desktop columns",async({page},info)=>{
  await page.goto("/");const form=page.locator("form.public-inquiry");await form.locator("summary").click();await expect(form.getByLabel("Subject (optional)",{exact:true})).toBeVisible();
  expect(await form.evaluate(e=>getComputedStyle(e).padding)).toBe("0px");expect(await form.evaluate(e=>getComputedStyle(e).borderWidth)).toBe("0px");
  const width=page.viewportSize()!.width;if(width>=1024){const box=await page.locator(".inquiry-intake").boundingBox(),contact=await page.locator(".contact-intake").boundingBox();expect(box!.width).toBeGreaterThan(contact!.width*.5);}
  await page.screenshot({path:info.outputPath("inquiry-expanded.png"),fullPage:true});
  await form.getByLabel("Subject (optional)",{exact:true}).fill("ab");await form.locator("summary").click();
  await form.getByLabel("Full name",{exact:true}).fill("Synthetic validation");await form.getByLabel("Email address",{exact:true}).fill("validation@example.invalid");await form.getByLabel("How can we help?",{exact:true}).fill("This checks validation of collapsed optional fields.");await form.getByRole("checkbox").check();await form.getByRole("button",{name:"Send inquiry",exact:true}).click();
  await expect(form.locator("details")).toHaveAttribute("open","");await expect(form.getByLabel("Subject (optional)",{exact:true})).toBeFocused();
});

test("public subscription HTTP guards and one-click unsubscribe preserve explicit consent",async({request})=>{
  const origin=process.env.BETTER_AUTH_URL!, email=randomUUID()+"@example.invalid";
  expect((await request.post('/api/newsletter/subscribe',{headers:{origin:'https://wrong.example.invalid'},data:{email,consent:true}})).status()).toBe(403);
  expect((await request.post('/api/newsletter/subscribe',{headers:{origin,'content-type':'text/plain'},data:'email=test'})).status()).toBe(415);
  expect((await request.post('/api/newsletter/subscribe',{headers:{origin},data:{email,consent:false}})).status()).toBe(400);
  expect((await request.post('/api/newsletter/subscribe',{headers:{origin},data:{email,consent:true,website:'x'.repeat(5000)}})).status()).toBe(400);
  expect((await request.get('/api/newsletter/confirm')).status()).toBe(405);
  const db=new Pool(databaseOptions());
  try {
    await request.post('/api/newsletter/subscribe',{headers:{origin},data:{email,consent:true}});
    const row=(await db.query('SELECT * FROM tpa.public_subscribers WHERE email=$1',[email])).rows[0];
    const c=await db.connect();let token:string;try{token=await publicUnsubscribeToken(c,row.id,row.version);}finally{c.release();}
    const link=await request.get(`/api/newsletter/unsubscribe?token=${token}`,{maxRedirects:0});expect(link.status()).toBe(303);expect(link.headers()['referrer-policy']).toBe('no-referrer');
    expect((await db.query('SELECT status FROM tpa.public_subscribers WHERE id=$1',[row.id])).rows[0].status).toBe('pending');
    const result=await request.post(`/api/newsletter/unsubscribe?token=${token}`,{form:{'List-Unsubscribe':'One-Click'}});expect(result.status()).toBe(200);
    expect((await db.query('SELECT status FROM tpa.public_subscribers WHERE id=$1',[row.id])).rows[0].status).toBe('unsubscribed');
  } finally {await db.end();}
});

test("staff preview explicitly selects confirmed public subscribers",async({request})=>{
  const db=new Pool(databaseOptions()), actor=randomUUID(), subscriber=randomUUID(), token=randomBytes(24).toString('hex');
  try{
    await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Synthetic communications\',$2,true)',[actor,actor+'@example.invalid']);
    await db.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'communications_operator')",[actor]);
    await db.query('INSERT INTO public."session"(id,"expiresAt",token,"createdAt","updatedAt","userId") VALUES($1,now()+interval \'1 hour\',$2,now(),now(),$3)',[randomUUID(),token,actor]);
    await db.query("INSERT INTO tpa.public_subscribers(id,email,status,consent_version,confirmed_at) VALUES($1,$2,'confirmed','public-newsletter-events-v1',now())",[subscriber,subscriber+'@example.invalid']);
    const signed=token+'.'+createHmac('sha256',process.env.BETTER_AUTH_SECRET!).update(token).digest('base64');
    const response=await request.post('/api/staff/campaigns',{headers:{origin:process.env.BETTER_AUTH_URL!,cookie:'better-auth.session_token='+encodeURIComponent(signed)},data:{action:'preview',audience:{source:'public',city:'',profession:''}}});
    expect(response.status()).toBe(200);const body=await response.json();expect(body.audience.source).toBe('public');expect(body.sample.some((p:{email:string})=>p.email===subscriber+'@example.invalid')).toBe(true);expect(body.deliveryEnabled).toBe(false);
  }finally{await db.query('DELETE FROM tpa.public_subscribers WHERE id=$1',[subscriber]);await db.query('DELETE FROM public."user" WHERE id=$1',[actor]);await db.end();}
});
