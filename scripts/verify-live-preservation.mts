import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash,randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { databaseOptions } from '../src/lib/database-options';
const production=new Pool(databaseOptions());
const local=new Pool({connectionString:'postgresql://tpa_qa@127.0.0.1:55439/postgres',ssl:false});
const name='tpa_product_restore_'+randomUUID().replaceAll('-','');
let restored:Pool|undefined;
const digest=(rows:unknown[])=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
try {
 assert.equal((await production.query('SELECT current_database() n')).rows[0].n,process.env.TPA_DATABASE_NAME);
 await local.query('CREATE DATABASE '+name);
 restored=new Pool({connectionString:'postgresql://tpa_qa@127.0.0.1:55439/'+name,ssl:false});
 await restored.query((await readFile('.local/live-product/recovery.sql','utf8')).replace(/^\\(?:un)?restrict.*$/gm,''));
 const checks=[];
 for(const table of ['public."user"','public."account"','tpa.people','tpa.memberships','tpa.account_invitation_holds','tpa.profile_portraits','tpa.payment_details']) {
  const key=table==='tpa.account_invitation_holds'?'user_id':'id';
  const source=(await restored.query('SELECT * FROM '+table+' ORDER BY '+key)).rows;
  const current=(await production.query('SELECT * FROM '+table+' WHERE '+key+'=ANY($1) ORDER BY '+key,[source.map(r=>r[key])])).rows;
  assert.equal(digest(current),digest(source),'Existing records changed: '+table);
  checks.push({table,records:source.length,unchanged:true});
 }
 const content=(await production.query("SELECT id,slug,version,published IS NULL withdrawn FROM tpa.content_entries WHERE slug='tpa-live-qa-20261012'")).rows;
 const person=(await production.query("SELECT id,version,published IS NULL withdrawn FROM tpa.people WHERE draft->>'name'='TPA QA Temporary Person 20261012'")).rows;
 assert.equal(content.length,1);assert.equal(person.length,1);assert.equal(content[0].withdrawn,true);assert.equal(person[0].withdrawn,true);
 const actions=(await production.query('SELECT action,entity_id,created_at FROM tpa.audit_events WHERE entity_id=ANY($1::text[]) ORDER BY created_at',[[content[0].id,person[0].id]])).rows;
 const counts=(await production.query('SELECT (SELECT count(*)::int FROM public."user") accounts,(SELECT count(*)::int FROM tpa.people) people,(SELECT count(*)::int FROM tpa.memberships) memberships,(SELECT count(*)::int FROM tpa.people WHERE published IS NOT NULL) published_people,(SELECT count(*)::int FROM tpa.content_entries) content,(SELECT count(*)::int FROM tpa.events) events,(SELECT count(*)::int FROM tpa.account_invitation_holds WHERE released_at IS NULL) holds,(SELECT count(*)::int FROM tpa.email_jobs) email_jobs')).rows[0];
 const evidence={checked:new Date().toISOString(),productionWrites:false,existingRecordsUnchanged:true,checks,counts,testRecords:{content,person},actions,cleanup:'Both test records withdrawn and retained privately; no supported record archive/delete control'};
 await writeFile('.local/live-product/preservation-final.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({existingRecordsUnchanged:true,checks,counts,testRecords:evidence.testRecords}));
} catch {throw Error('Preservation reconciliation failed; sensitive diagnostics withheld');}
finally {await restored?.end();await local.query('DROP DATABASE IF EXISTS '+name+' WITH (FORCE)');await local.end();await production.end();}
