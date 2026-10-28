/** Account-state diagnostics only: no password values, tokens, user IDs or contacts exported. */
import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {parseEnv} from "node:util";
import {resolve,dirname} from "node:path";
import {Pool} from "pg";
import {databaseOptions} from "../src/lib/database-options";
assert.equal(process.argv[2],"--production-readonly");
const file=resolve(process.argv[3]||"missing-configuration"),fingerprint=process.argv[4];
assert.match(fingerprint||"",/^[a-f0-9]{32}$/,"Supply a transient fingerprint, never raw contact data");
assert.notEqual(fingerprint,"ee1f021828a1fcbcc56d8ab865fb22f2","Browser-redacted fields cannot identify an account; no lookup was performed");
const env=parseEnv(await readFile(file,"utf8"));
if(env.DATABASE_CA_FILE)env.DATABASE_CA_FILE=resolve(dirname(file),env.DATABASE_CA_FILE);
const pool=new Pool({...databaseOptions(env),max:1,options:"-c default_transaction_read_only=on -c statement_timeout=10000"});
const output=".local/launch-readiness/live-login-diagnosis-"+new Date().toISOString().replaceAll(":","-");await mkdir(output,{recursive:true});
const report:Record<string,unknown>={observed:new Date().toISOString(),environment:"hosted aggregate read-only",passwordInspected:false,credentialMutation:false,invitationMutation:false};
try{
 const c=await pool.connect();
 try{
  await c.query("BEGIN READ ONLY");assert.equal((await c.query("SHOW transaction_read_only")).rows[0].transaction_read_only,"on");
  report.accountState=(await c.query(`SELECT count(*)::int AS matching_accounts,
   bool_or(u."emailVerified") AS email_verified,
   bool_or(EXISTS(SELECT 1 FROM tpa.staff_roles r WHERE r.user_id=u.id AND r.role='administrator')) AS administrator_role,
   bool_or(EXISTS(SELECT 1 FROM tpa.operator_approved_identities p WHERE p.user_id=u.id)) AS operator_approved,
   bool_or(EXISTS(SELECT 1 FROM tpa.account_invitation_holds h WHERE h.user_id=u.id AND h.released_at IS NULL)) AS invitation_held,
   bool_or(EXISTS(SELECT 1 FROM public."account" a WHERE a."userId"=u.id AND a."providerId"='credential' AND a.password IS NOT NULL)) AS credential_exists,
   bool_or(EXISTS(SELECT 1 FROM public."account" a WHERE a."userId"=u.id AND a."providerId"='credential' AND a.password ~ '^[0-9a-f]+:[0-9a-f]+$')) AS standard_scrypt_format
   FROM public."user" u WHERE md5(lower(btrim(u.email)))=$1`,[fingerprint])).rows[0];
  report.readOnlyTransactionVerified=true;report.result="VERIFIED";
  report.recentAdminRecovery=(await c.query("SELECT status,created_at,attempts,(provider_id IS NOT NULL) AS provider_accepted FROM tpa.onboarding_mail WHERE kind='recovery' AND md5(lower(btrim(recipient)))=$1 AND created_at>now()-interval '15 minutes' ORDER BY created_at DESC LIMIT 5",[fingerprint])).rows;
  report.recentRecoveryReceipts=(await c.query("SELECT r.created_at,(EXISTS(SELECT 1 FROM tpa.email_events e WHERE e.provider_id=r.provider_id AND e.type='email.delivered')) AS delivery_event,(EXISTS(SELECT 1 FROM tpa.email_events e WHERE e.provider_id=r.provider_id AND e.type='email.bounced')) AS bounce_event FROM tpa.email_receipts r JOIN public.\"user\" u ON u.id=r.user_id WHERE r.kind='recovery' AND md5(lower(btrim(u.email)))=$1 AND r.created_at>now()-interval '15 minutes' ORDER BY r.created_at DESC LIMIT 5",[fingerprint])).rows;
 }finally{await c.query("ROLLBACK");c.release();}
}catch(error){report.result="BLOCKED";report.errorCode=(error as {code?:string}).code||"connection-or-schema-check";}
finally{await pool.end();await writeFile(output+"/results.json",JSON.stringify(report,null,2));}
console.log(JSON.stringify({evidence:output+"/results.json",...report}));
if(report.result==="BLOCKED")process.exitCode=1;
