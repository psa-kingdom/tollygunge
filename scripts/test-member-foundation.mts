import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFile, stat } from "node:fs/promises";
import assert from "node:assert/strict";
import { databaseOptions } from "../src/lib/database-options";
const name="tpa_onboarding_test_member_"+randomUUID().replaceAll("-",""),port=process.env.TPA_MEMBER_TEST_PORT??"3127";
const started=Date.now();
const root=new Pool(databaseOptions()),url=new URL(process.env.DATABASE_URL!);url.pathname="/"+name;
const env={...process.env,DATABASE_URL:url.toString(),TPA_DATABASE_NAME:name,BETTER_AUTH_URL:"http://127.0.0.1:"+port,
  ONBOARDING_ENABLED:"true",TPA_MAIL_SINK:"true",TPA_TEST_URL:"http://127.0.0.1:"+port,
  BETTER_AUTH_SECRET:"synthetic-member-foundation-test-secret-at-least-32-characters",
  SMTP_HOST:"",SMTP_USER:"",SMTP_PASSWORD:"",RESEND_API_KEY:"",RESEND_DOMAIN_VERIFIED:"false",
  R2_ACCESS_KEY_ID:"",R2_SECRET_ACCESS_KEY:"",CLOUDFLARE_CREDENTIAL_FILE:"",TPA_TEST_STORAGE:"false",TPA_TEST_EXPECT_STORAGE_DISABLED:"true"};
async function run(args:string[],expectedFailure=false) {
  const code=await new Promise<number>((resolve,reject)=>{
    const p=spawn(process.execPath,args,{env,stdio:expectedFailure?"pipe":"inherit"});
    p.on("error",reject);p.on("exit",code=>resolve(code??1));
  });
  if(expectedFailure) assert.notEqual(code,0,"Expected collision migration to abort");else assert.equal(code,0,"Test command failed");
}
let server:ReturnType<typeof spawn>|undefined;
try {
  await root.query(`CREATE DATABASE ${name}`);console.log("Created isolated member test database:",name);
  await run(["scripts/migrate.mjs","--through","022"]);
  const fixture=new Pool(databaseOptions(env)),id=randomUUID();
  try {
    await fixture.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Legacy professional\',\'collision@example.invalid\',false),($2,\'Synthetic duplicate\',\'COLLISION@example.invalid\',false)',[id,randomUUID()]);
    await fixture.query("INSERT INTO tpa.people(id,user_id,accepted,draft) VALUES($1,$2,'{\"name\":\"Legacy professional\",\"phone\":\"9876543210\"}','{\"name\":\"Legacy professional\",\"phone\":\"9876543210\"}')",[randomUUID(),id]);
    await fixture.query("INSERT INTO tpa.application_drafts(id,user_id,plan,category,details) VALUES($1,$2,'Annual','Student','{\"studentEvidence\":\"legacy-evidence\",\"address\":\"Legacy text\"}')",[randomUUID(),id]);
    await fixture.query("INSERT INTO tpa.verification_policies(version,fields) VALUES(1,'[{\"id\":\"fullName\",\"label\":\"Full name\",\"type\":\"text\",\"categories\":[\"Professional\",\"Student\"]},{\"id\":\"studentEvidence\",\"documentKind\":\"student_evidence\",\"categories\":[\"Student\"]}]')");
    await run(["scripts/migrate.mjs"],true);
    assert.equal((await fixture.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='tpa' AND table_name='people' AND column_name='contact_email'")).rows[0].n,0);
    await fixture.query('DELETE FROM public."user" WHERE email=\'COLLISION@example.invalid\'');
    await run(["scripts/migrate.mjs"]);await run(["scripts/migrate.mjs"]);
    assert.equal((await fixture.query("SELECT count(*)::int n FROM tpa.verification_policies")).rows[0].n,2);
    assert.ok(JSON.stringify((await fixture.query("SELECT fields FROM tpa.verification_policies WHERE version=1")).rows).includes("Student"));
    assert.ok(!JSON.stringify((await fixture.query("SELECT fields FROM tpa.verification_policies WHERE version=2")).rows).includes("Student"));
    assert.equal((await fixture.query("SELECT details FROM tpa.application_drafts WHERE user_id=$1",[id])).rows[0].details.studentEvidence,"legacy-evidence");
    // Other suites require the complete latest policy; the legacy fixture remains immutable.
    const {initialFields}=await import("../src/domain/verification");
    await fixture.query("INSERT INTO tpa.verification_policies(version,fields) VALUES(3,$1)",[JSON.stringify(initialFields)]);
  } finally {await fixture.end();}
  await run(["--import","tsx","scripts/provision-postal.mts"]);
  await run(["--conditions=react-server","--import","tsx","--test",...(process.argv.includes("--http-only")?["--test-name-pattern=concurrent|postal hierarchy|legacy Student|preservation imports|invitation queue failure"]:[]),"tests/member-foundation.integration.ts"]);
  await run(["--import","tsx","--test","tests/database.integration.ts","tests/identity.integration.ts","tests/onboarding-auth.integration.ts","tests/onboarding-delivery.integration.ts"]);
  if(process.argv.includes("--http") || process.argv.includes("--http-only")) {
    if(process.argv.includes("--wait-build")) {
      console.log("Waiting for latest fixed build: .local/member-http-build-ready");
      while(true) {try {if((await stat(".local/member-http-build-ready")).mtimeMs>=started) break;}catch {}await new Promise(resolve=>setTimeout(resolve,1000));}
    }
    const logs=await import("node:fs");const log=logs.openSync(".local/member-http-server.log","w");
    server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",port],{env,stdio:["ignore",log,log]});
    let ready=false;
    for(let n=0;n<60;n++) {if(server.exitCode!==null) throw Error("Test server stopped");try {ready=(await fetch(env.TPA_TEST_URL+"/api/health")).ok;} catch {}if(ready) break;await new Promise(resolve=>setTimeout(resolve,1000));}
    assert.ok(ready,"Isolated HTTP server did not become ready");
    await run(["--import","tsx","--test","tests/member-foundation-http.integration.ts","tests/onboarding-http.integration.ts","tests/workspace-ux-http.integration.ts"]);
    server.kill("SIGTERM");await new Promise(resolve=>server!.once("exit",resolve));
    env.ONBOARDING_ENABLED="false";
    server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",port],{env,stdio:["ignore",log,log]});
    ready=false;
    for(let n=0;n<60;n++) {if(server.exitCode!==null) throw Error("Test server stopped");try {ready=(await fetch(env.TPA_TEST_URL+"/api/health")).ok;} catch {}if(ready) break;await new Promise(resolve=>setTimeout(resolve,1000));}
    assert.ok(ready,"Baseline HTTP server did not become ready");
    await run(["--import","tsx","--test","tests/operations.integration.ts","tests/governance.integration.ts","tests/http.integration.ts"]);
  }
  await writeFile(".local/member-foundation-acceptance.json",JSON.stringify({database:name,passed:true,http:process.argv.includes("--http")||process.argv.includes("--http-only"),memberSuite:process.argv.includes("--http-only")?"postal, concurrency, legacy and preservation":"full",completed:new Date().toISOString()}));
} finally {
  server?.kill("SIGTERM");if(server) await new Promise(resolve=>server!.exitCode!==null?resolve(null):server!.once("exit",resolve));
  await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await root.end();
}
