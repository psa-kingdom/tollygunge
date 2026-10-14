import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { databaseOptions } from '../src/lib/database-options';
import { fetchEmailQuota } from '../src/lib/email-provider';
import assert from 'node:assert/strict';

export function managedMailEnv() {
  const cli = 'C:/Users/savag/AppData/Roaming/npm/node_modules/@railway/cli/bin/railway.js';
  function read(args: string[]) {
    try { return JSON.parse(execFileSync(process.execPath, [cli, ...args], {stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024}).toString()); }
    catch { throw Error('Managed configuration unavailable; sensitive diagnostics withheld.'); }
  }
  assert.equal(read(['status','--json']).id, '1f2b5099-790f-48c3-96e9-e62b142157fb');
  const values=read(['variables','--service','tpa-web','--environment','production','--json']);
  return Object.fromEntries(['RESEND_API_KEY','RESEND_RECEIVING_API_KEY','RESEND_WEBHOOK_SECRET','AUTH_EMAIL_FROM','RESEND_DOMAIN_VERIFIED','ONBOARDING_ENABLED','EMAIL_OPERATIONS_ENABLED'].map(k=>[k,values[k] as string | undefined]));
}
export async function mailPreflight() {
  const pool=new Pool(databaseOptions());
  try {
    const recipients=(await pool.query('SELECT test_recipients FROM tpa.onboarding_settings WHERE id=true')).rows[0]?.test_recipients as string[];
    assert.ok(Array.isArray(recipients) && recipients.length>0,'Approved test inbox list is empty.');
    const env=managedMailEnv();
    assert.ok(env.RESEND_API_KEY && env.RESEND_RECEIVING_API_KEY && env.RESEND_WEBHOOK_SECRET && env.RESEND_DOMAIN_VERIFIED==='true','Managed mail readiness is incomplete.');
    const quota=await fetchEmailQuota(env.RESEND_RECEIVING_API_KEY!);
    const suppressed=(await pool.query('SELECT email FROM tpa.email_suppressions WHERE email=ANY($1::text[])',[recipients])).rows;
    assert.equal(suppressed.length,0,'An approved test inbox is suppressed.');
    const output={recipients,sender:env.AUTH_EMAIL_FROM,managedReady:true,quota,worker:(await pool.query("SELECT heartbeat_at,status FROM tpa.email_worker_state WHERE id='email'")).rows[0]};
    return {env,output};
  } finally {await pool.end();}
}
if (process.argv[1]?.endsWith('operational-mail-preflight.mts')) {
  try {console.log(JSON.stringify((await mailPreflight()).output));}
  catch {console.error('Mail preflight failed; no mail sent and sensitive diagnostics withheld.');process.exitCode=1;}
}
