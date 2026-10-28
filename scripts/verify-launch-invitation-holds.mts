/** Aggregate-only production preservation check. Never releases invitations or creates sessions. */
import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {parseEnv} from "node:util";
import {dirname,resolve} from "node:path";
import {Pool} from "pg";
import {databaseOptions} from "../src/lib/database-options";

assert.equal(process.argv[2],"--production-readonly","Explicit read-only production mode required");
const file=resolve(process.argv[3]||"missing-configuration");
const env=parseEnv(await readFile(file,"utf8"));
const dbUrl=new URL(env.DATABASE_URL||"");
assert.ok(!["127.0.0.1","localhost","[::1]"].includes(dbUrl.hostname),"This observation must identify the hosted database, not a fixture");
if(env.DATABASE_CA_FILE)env.DATABASE_CA_FILE=resolve(dirname(file),env.DATABASE_CA_FILE);
const output=".local/launch-readiness/invitation-preservation-"+new Date().toISOString().replaceAll(":","-");
await mkdir(output,{recursive:true});
const report:Record<string,unknown>={observed:new Date().toISOString(),environment:"hosted database aggregate read-only",expectedHeld:202,accountOrInvitationMutation:false,realEmailsSent:0,personalDataExported:false};
const pool=new Pool({...databaseOptions(env),max:1,options:"-c default_transaction_read_only=on -c statement_timeout=10000"});
try{
 const client=await pool.connect();
 try{
  await client.query("BEGIN READ ONLY");
  assert.equal((await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only,"on");
  const counts=(await client.query(`SELECT
   (SELECT count(*)::int FROM tpa.memberships m JOIN tpa.people p ON p.id=m.person_id JOIN tpa.account_invitation_holds h ON h.user_id=p.user_id WHERE h.released_at IS NULL) AS dashboard_held,
   (SELECT count(*)::int FROM tpa.account_invitation_holds WHERE released_at IS NULL) AS all_unreleased_holds,
   (SELECT count(*)::int FROM tpa.onboarding_mail WHERE kind='invitation' AND status IN ('queued','leased')) AS queued_or_leased_invitation_mail,
   (SELECT count(*)::int FROM tpa.invitation_template_state WHERE singleton AND approved_id IS NOT NULL) AS approved_template_available`)).rows[0];
  report.counts=counts;report.readOnlyTransactionVerified=true;
  report.result=counts.dashboard_held===202 && counts.all_unreleased_holds===202 && counts.queued_or_leased_invitation_mail===0?"PASS":"FAIL";
  report.limitation="Counts use the dashboard's exact held metric. Eligibility/template/review freshness and actual mailbox delivery are separate; no review or send action was invoked.";
 }finally{await client.query("ROLLBACK");client.release();}
}catch(error){report.result="BLOCKED";report.errorCode=(error as {code?:string}).code||"connection-or-schema-check";report.limitation="Read-only aggregate verification could not complete; no credential or database error detail emitted.";}
finally{await pool.end();await writeFile(output+"/results.json",JSON.stringify(report,null,2));}
console.log(JSON.stringify({evidence:output+"/results.json",...report}));
if(report.result!=="PASS")process.exitCode=1;
