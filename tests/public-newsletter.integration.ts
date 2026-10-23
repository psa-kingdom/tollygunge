import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { databaseOptions } from "../src/lib/database-options";
import { requestPublicSubscription, confirmPublicSubscription, unsubscribePublicSubscription } from "../src/lib/public-newsletter";
import { reviewCampaign, dispatchCampaign, campaignRecipients } from "../src/lib/email-service";
import { processEmailJob } from "../src/lib/email-worker";
import { openMail } from "../src/lib/onboarding-mail";
import { tokenHash } from "../src/domain/email";
import { EmailProviderError } from "../src/lib/email-provider";

test("public newsletter lifecycle and delivery use isolated consent and the existing worker", {skip: !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_")}, async t => {
  const pool = new Pool(databaseOptions());
  const env: Record<string,string|undefined> = { ...process.env, EMAIL_OPERATIONS_ENABLED:"true", RESEND_DOMAIN_VERIFIED:"true", RESEND_API_KEY:"synthetic", RESEND_RECEIVING_API_KEY:"synthetic", RESEND_WEBHOOK_SECRET:"synthetic" };
  Object.assign(process.env, env);
  const prefix=randomUUID(), email=prefix+"@example.invalid", owner=randomUUID();
  const quota={daily:{used:0,limit:100,resets_at:"2099-01-01T00:00:00Z"},monthly:{used:0,limit:3000,resets_at:"2099-01-01T00:00:00Z"}};
  const requests: Record<string,unknown>[]=[];
  const deps={quota:async()=>structuredClone(quota),request:async(_path:string,_key:string,body?:unknown)=>{requests.push(body as Record<string,unknown>);return {id:randomUUID()};}};
  const state=async(id:string)=>(await pool.query("SELECT * FROM tpa.email_jobs WHERE id=$1",[id])).rows[0];
  const lease=async(id:string)=>{await pool.query("UPDATE tpa.email_jobs SET status='leased',lease_owner=$2,lease_until=now()+interval '2 minutes' WHERE id=$1",[id,owner]);};
  const lastConfirmation=async(address:string)=>(await pool.query("SELECT * FROM tpa.email_jobs WHERE recipient=$1 AND kind='subscription_confirmation' ORDER BY created_at DESC,id DESC LIMIT 1",[address])).rows[0];
  const tokenFor=(job:{payload:{sealedBody:Parameters<typeof openMail>[0]}})=>new URL((openMail(job.payload.sealedBody,env.BETTER_AUTH_SECRET) as string).split("\n").find(line=>line.startsWith("http"))!).hash.split("token=")[1];
  let confirmation: Awaited<ReturnType<typeof lastConfirmation>>, subscriber:string;
  try {
    const before=(await pool.query('SELECT count(*)::int n FROM public."user"')).rows[0].n;
    await t.test("guest requests are normalized, private, idempotent and create no accounts",async()=>{
      const [response,duplicate]=await Promise.all([requestPublicSubscription(pool,{email:email.toUpperCase(),consent:true},env),requestPublicSubscription(pool,{email,consent:true},env)]);
      assert.deepEqual(response,duplicate);
      confirmation=await lastConfirmation(email); assert.ok(confirmation);
      const row=(await pool.query("SELECT * FROM tpa.public_subscribers WHERE email=$1",[email])).rows[0]; subscriber=row.id;
      assert.equal(row.status,"pending");assert.equal(row.consent_version,"public-newsletter-events-v1");
      assert.equal((await pool.query('SELECT count(*)::int n FROM public."user"')).rows[0].n,before);
      assert.equal((await pool.query("SELECT count(*)::int n FROM tpa.email_jobs WHERE subscriber_id=$1",[subscriber])).rows[0].n,1);
      assert.equal(confirmation.user_id,null);assert.ok(!JSON.stringify(confirmation.payload).includes(tokenFor(confirmation)));
      assert.ok((await pool.query("SELECT 1 FROM tpa.public_subscription_tokens WHERE token_hash=$1",[tokenHash(tokenFor(confirmation))])).rowCount);
    });
    await t.test("confirmation delivery honors quota and retry semantics with synthetic transport",async()=>{
      await lease(confirmation.id);await processEmailJob(pool,confirmation.id,owner,env,{...deps,quota:async()=>({...quota,daily:{...quota.daily,used:100}})});
      assert.equal((await state(confirmation.id)).reason,"quota_wait");assert.equal(requests.length,0);
      await lease(confirmation.id);await processEmailJob(pool,confirmation.id,owner,env,{...deps,request:async()=>{throw new EmailProviderError(true,false,"rate_limited");}});
      assert.equal((await state(confirmation.id)).status,"queued");
      await lease(confirmation.id);await processEmailJob(pool,confirmation.id,owner,env,deps);
      assert.equal((await state(confirmation.id)).status,"accepted");assert.equal(requests.length,1);assert.ok(String(requests[0].text).includes("Confirm subscription"));
    });
    await t.test("confirmation is explicit, single use and expires",async()=>{
      assert.equal((await confirmPublicSubscription(pool,tokenFor(confirmation))).confirmed,true);
      await assert.rejects(()=>confirmPublicSubscription(pool,tokenFor(confirmation)),/invalid or expired/);
      const expired="expired-"+email;await requestPublicSubscription(pool,{email:expired,consent:true},env);const job=await lastConfirmation(expired);
      await pool.query("UPDATE tpa.public_subscription_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[tokenHash(tokenFor(job))]);
      await assert.rejects(()=>confirmPublicSubscription(pool,tokenFor(job)),/invalid or expired/);
      await assert.rejects(()=>confirmPublicSubscription(pool,"bad"),/invalid/);
    });
    await t.test("database throttles cooldown, daily address requests and global volume",async()=>{
      const address="throttle-"+email;
      for(let n=0;n<4;n++){await requestPublicSubscription(pool,{email:address,consent:true},env);await pool.query("UPDATE tpa.public_subscription_requests SET requested_at=now()-interval '2 minutes' WHERE email=$1",[address]);}
      assert.equal((await pool.query("SELECT count(*)::int n FROM tpa.public_subscription_requests WHERE email=$1",[address])).rows[0].n,3);
      await pool.query("INSERT INTO tpa.public_subscription_requests(email) SELECT 'load@example.invalid' FROM generate_series(1,100)");
      await requestPublicSubscription(pool,{email:"blocked-"+email,consent:true},env);assert.equal((await pool.query("SELECT 1 FROM tpa.public_subscribers WHERE email=$1",["blocked-"+email])).rowCount,0);
      await pool.query("DELETE FROM tpa.public_subscription_requests WHERE email='load@example.invalid'");
      await assert.rejects(()=>requestPublicSubscription(pool,{email,consent:false},env));await assert.rejects(()=>requestPublicSubscription(pool,{email,consent:true,website:"bot"},env));
    });
    const actor=randomUUID(), account=randomUUID();
    await pool.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Synthetic sender\',$3,true),($2,\'Independent member\',$4,true)',[actor,account,actor+"@example.invalid",email]);
    await pool.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'communications_operator')",[actor]);
    await pool.query("INSERT INTO tpa.newsletter_consents(user_id,subscribed,source) VALUES($1,false,'synthetic')",[account]);
    const dispatch=async()=>{
      const id=randomUUID();await pool.query("INSERT INTO tpa.campaign_drafts(id,name,subject,body,audience,updated_by) VALUES($1,'Public newsletter','Public TPA news','Synthetic newsletter and public events',$2,$3)",[id,{city:"",profession:"",source:"public"},actor]);
      await pool.query("UPDATE tpa.email_worker_state SET heartbeat_at=now(),status='ready' WHERE id='email'");
      const review=await reviewCampaign(pool,actor,id,1);assert.equal(review.eligible,1);
      const result=await dispatchCampaign(pool,actor,id,1,review.reviewToken);const job=(await pool.query("SELECT * FROM tpa.email_jobs WHERE dispatch_id=$1",[result.id])).rows[0];return job;
    };
    await t.test("public audience excludes pending addresses, deduplicates and uses public unsubscribe headers",async()=>{
      const c=await pool.connect();try{const rows=await campaignRecipients(c,{city:"",profession:"",source:"public"});assert.equal(rows.length,1);assert.equal(rows[0].subscriberId,subscriber);}finally{c.release();}
      const job=await dispatch();assert.equal(job.user_id,null);assert.equal(job.subscriber_id,subscriber);
      await lease(job.id);await processEmailJob(pool,job.id,owner,env,deps);assert.equal((await state(job.id)).status,"accepted");
      assert.ok(JSON.stringify(requests.at(-1)?.headers).includes("/api/newsletter/unsubscribe"));
    });
    await t.test("unsubscribe during quota lookup prevents sending and leaves member preferences intact",async()=>{
      const job=await dispatch(), url=new URL(openMail(job.payload.unsubscribe,env.BETTER_AUTH_SECRET));const token=new URLSearchParams(url.hash.slice(1)).get("token")!;const sent=requests.length;
      await lease(job.id);await processEmailJob(pool,job.id,owner,env,{...deps,quota:async()=>{await unsubscribePublicSubscription(pool,token);return quota;}});
      assert.equal(requests.length,sent);assert.equal((await state(job.id)).status,"skipped");
      await unsubscribePublicSubscription(pool,token);assert.equal((await pool.query("SELECT subscribed FROM tpa.newsletter_consents WHERE user_id=$1",[account])).rows[0].subscribed,false);
      await pool.query("UPDATE tpa.public_subscription_requests SET requested_at=now()-interval '2 minutes' WHERE email=$1",[email]);
      await requestPublicSubscription(pool,{email,consent:true},env);const renewed=await lastConfirmation(email);assert.notEqual(tokenFor(renewed),tokenFor(confirmation));
      await assert.rejects(()=>confirmPublicSubscription(pool,tokenFor(confirmation)));await confirmPublicSubscription(pool,tokenFor(renewed));
    });
    await t.test("suppression and cancellation are checked again before guest delivery",async()=>{
      const cancelled=await dispatch();await pool.query("UPDATE tpa.email_dispatches SET cancelled_at=now() WHERE id=$1",[cancelled.dispatch_id]);await lease(cancelled.id);await processEmailJob(pool,cancelled.id,owner,env,deps);assert.equal((await state(cancelled.id)).status,"skipped");
      const job=await dispatch(),sent=requests.length;await pool.query("INSERT INTO tpa.email_suppressions(email,reason) VALUES($1,'bounce')",[email]);
      await lease(job.id);await processEmailJob(pool,job.id,owner,env,deps);assert.equal((await state(job.id)).reason,"suppressed");assert.equal(requests.length,sent);
      const address="suppressed-"+email;await pool.query("INSERT INTO tpa.email_suppressions(email,reason) VALUES($1,'complaint')",[address]);await requestPublicSubscription(pool,{email:address,consent:true},env);assert.equal((await pool.query("SELECT 1 FROM tpa.public_subscribers WHERE email=$1",[address])).rowCount,0);
    });
  } finally { await pool.end(); }
});
