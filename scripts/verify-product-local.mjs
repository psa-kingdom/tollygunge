import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
const rootUrl=new URL(process.env.DATABASE_URL||'');
assert.equal(rootUrl.hostname,'127.0.0.1');assert.equal(rootUrl.port,'55439');
const root=new Pool({connectionString:rootUrl.href,ssl:false});
const name='tpa_product_test_'+randomUUID().replaceAll('-','');
const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,USERPROFILE:process.env.USERPROFILE};
for(const file of ['.env','.env.local','.env.production','.env.production.local']) {
 try {for(const line of (await readFile(file,'utf8')).split(/\r?\n/)){const key=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];if(key)env[key]='';}}catch{}
}
const base='http://127.0.0.1:3147';
Object.assign(env,{DATABASE_URL:'postgresql://tpa_qa@127.0.0.1:55439/'+name,DATABASE_SSL:'false',TPA_DATABASE_NAME:name,BETTER_AUTH_URL:base,BETTER_AUTH_SECRET:'synthetic-product-qa-secret-32-characters',TPA_TEST_URL:base,TPA_MAIL_SINK:'true',EMAIL_OPERATIONS_ENABLED:'false',EVENT_REMINDERS_ENABLED:'false',EVENT_PROMOTIONS_ENABLED:'false',MEMBER_IMPORT_WORKER_ENABLED:'false'});
let server;
try {
 await root.query('CREATE DATABASE '+name);
 execFileSync(process.execPath,['scripts/migrate.mjs'],{env,stdio:'inherit'});
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3147'],{env,stdio:'inherit'});
 let ready=false;
 for(let i=0;i<60;i++){if(server.exitCode!==null)throw Error('QA server stopped');try{if((await fetch(base+'/login')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,1000));}
 assert.ok(ready);
 execFileSync(process.execPath,['--import','tsx','--test','tests/governance.integration.ts','tests/operations.integration.ts'],{env,stdio:'inherit'});
 const db=new Pool({connectionString:env.DATABASE_URL,ssl:false});
 try {
  const actor=randomUUID();
  await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,false)',[actor,'Synthetic metadata fixture',actor+'@example.invalid']);
  await db.query("INSERT INTO tpa.content_entries(id,slug,kind,draft,published,updated_by) VALUES($1,'qa-metadata','insight',$2,$2,$3)",[randomUUID(),JSON.stringify({title:'Synthetic article metadata',intro:'Synthetic description',sections:[],sourceUrl:'',attribution:''}),actor]);
  const response=await fetch(base+'/resources/qa-metadata');
  assert.equal(response.status,200);const html=await response.text();
  assert.ok(html.includes('<title>Synthetic article metadata | TPA</title>'));
  assert.ok(html.includes('name="description" content="Synthetic description"'));
  console.log('PASS: published article title and description metadata');
 } finally {await db.end();}
} finally {
 if(server){server.kill();if(server.exitCode===null)await new Promise(r=>server.once('exit',r));}
 await root.query('DROP DATABASE IF EXISTS '+name+' WITH (FORCE)');await root.end();
}
