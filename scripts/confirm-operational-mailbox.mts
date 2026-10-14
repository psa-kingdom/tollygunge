import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {Pool} from 'pg';
import {databaseOptions} from '../src/lib/database-options';

// Use only after direct mailbox inspection or explicit recipient confirmation of all five.
const file=process.argv[2],recipient=process.argv[3];
const inspected=process.argv.includes('--browser-observed-all-five');
assert.ok(file && recipient && (inspected || process.argv.includes('--recipient-confirmed-all-five')),
  'Provide the acceptance JSON, approved recipient and explicit mailbox evidence flag.');
const directory=await realpath('.local/operational-delivery'),target=await realpath(resolve(file));
const rel=relative(directory,target);assert.ok(!rel.startsWith('..') && !isAbsolute(rel) && target.endsWith('acceptance.json'));
type Email={label:string;providerId:string;providerDelivered:boolean;signedHostedEvents:string[];mailboxReceived:boolean};
type Evidence={approvedRecipient:string;automatedAcceptancePassed:boolean;disposableDatabaseRemoved:boolean;hostedTestEventCleanup:boolean;emails:Email[];scenarios:Record<string,{passed:boolean}>;pending:string[];mailboxReceipt:string;passed:boolean;mailboxConfirmedAt?:string;mailboxEvidence?:string};
const evidence=JSON.parse(await readFile(target,'utf8')) as Evidence;
assert.equal(recipient,evidence.approvedRecipient);assert.equal(evidence.automatedAcceptancePassed,true);
assert.equal(evidence.disposableDatabaseRemoved,true);assert.equal(evidence.hostedTestEventCleanup,true);
for(const scenario of ['A','B','C','D','E','F','G','H'])assert.equal(evidence.scenarios[scenario]?.passed,true);
for(const label of ['invitation','recovery','registration pending','payment confirmation','event update']){
  const message=evidence.emails.find(m=>m.label===label);assert.ok(message?.providerDelivered && message.signedHostedEvents.includes('email.delivered'));
}
const pool=new Pool(databaseOptions());
try{
  const ids=evidence.emails.map(m=>m.providerId);
  const remaining=(await pool.query('SELECT (SELECT count(*)::int FROM tpa.email_events WHERE provider_id=ANY($1::text[]))+(SELECT count(*)::int FROM tpa.onboarding_mail_events WHERE provider_id=ANY($1::text[])) n',[ids])).rows[0].n;
  assert.equal(remaining,0,'Late test webhook projections require exact-ID cleanup before completion.');
}finally{await pool.end();}
if(inspected){
  const proof=JSON.parse(await readFile(resolve(target,'../mailbox-receipt.json'),'utf8')) as {recipient:string;observedLabels:string[];observedAt:string};
  assert.equal(proof.recipient,recipient);assert.ok(Number.isFinite(Date.parse(proof.observedAt)));
  for(const label of ['invitation','recovery','registration pending','payment confirmation','event update'])assert.ok(proof.observedLabels.includes(label));
  evidence.mailboxEvidence='mailbox-receipt.json';
}
evidence.emails.forEach(m=>{m.mailboxReceived=true;});evidence.mailboxReceipt=inspected?'browser-observed-all-five':'recipient-confirmed-all-five';
evidence.mailboxConfirmedAt=new Date().toISOString();evidence.pending=[];evidence.passed=true;
await writeFile(target,JSON.stringify(evidence,null,2));console.log('Staging operational acceptance complete; actual receipt of all five messages verified.');
