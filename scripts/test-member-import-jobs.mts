import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {databaseOptions} from '../src/lib/database-options';
const name='tpa_onboarding_test_jobs_'+randomUUID().replaceAll('-',''),root=new Pool(databaseOptions()),url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;
const env={...process.env,DATABASE_URL:url.toString(),TPA_DATABASE_NAME:name,ONBOARDING_ENABLED:'true',TPA_MAIL_SINK:'true',SMTP_HOST:'',SMTP_PASSWORD:'',RESEND_API_KEY:'',RESEND_RECEIVING_API_KEY:'',R2_ACCESS_KEY_ID:'',R2_SECRET_ACCESS_KEY:'',MEMBER_IMPORT_WORKER_ENABLED:'true',BETTER_AUTH_SECRET:'synthetic-member-jobs-secret-at-least-32-characters',BETTER_AUTH_URL:'http://127.0.0.1:3140',TPA_TEST_URL:'http://127.0.0.1:3140',TPA_BROWSER_CHANNEL:process.env.TPA_BROWSER_CHANNEL??'chrome'};
async function run(args:string[]){const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{env,stdio:'inherit'});p.on('error',reject);p.on('exit',resolve);});assert.equal(code,0);}
try{await root.query(`CREATE DATABASE ${name}`);console.log('Created isolated jobs database',name);
 await run(['scripts/migrate.mjs','--through','027']);
 const old=new Pool(databaseOptions(env)),actor=randomUUID(),batch=randomUUID();
 try{await old.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Legacy synthetic\',$2,false)',[actor,actor+'@example.invalid']);await old.query("INSERT INTO tpa.onboarding_batches(id,actor_id,rows,mode,results,committed_at) VALUES($1,$2,'[]','accounts','[]',now())",[batch,actor]);}finally{await old.end();}
 await run(['scripts/migrate.mjs']);await run(['scripts/migrate.mjs']);
 const migrated=new Pool(databaseOptions(env));try{const preserved=(await migrated.query('SELECT mode,results,committed_at FROM tpa.onboarding_batches WHERE id=$1',[batch])).rows[0];assert.equal(preserved.mode,'accounts');assert.deepEqual(preserved.results,[]);assert.ok(preserved.committed_at);assert.equal((await migrated.query('SELECT count(*)::int n FROM tpa.member_import_jobs')).rows[0].n,0);}finally{await migrated.end();}
 if(!process.argv.includes('--http-only'))await run(['--conditions=react-server','--import','tsx','--test',...(process.argv.includes('--quick')?['--test-name-pattern=mixed invalid|leases fence|diagnostic collects|individual creation racing']:[]),'tests/member-import-jobs.integration.ts']);
 if(!process.argv.includes('--http-only')){const verify=new Pool(databaseOptions(env));try{const totals=(await verify.query(`SELECT (SELECT count(*)::int FROM tpa.memberships) members,(SELECT count(DISTINCT lower(regexp_replace(btrim(membership_number),'[[:space:]]+',' ','g')))::int FROM tpa.memberships) unique_numbers,(SELECT count(DISTINCT contact_email)::int FROM tpa.people) unique_emails,(SELECT count(*)::int FROM tpa.people WHERE user_id IS NOT NULL) linked_accounts,(SELECT count(*)::int FROM tpa.onboarding_invitations) invitations,(SELECT count(*)::int FROM tpa.onboarding_mail) mail`)).rows[0];assert.equal(totals.members,totals.unique_numbers);assert.equal(totals.members,totals.unique_emails);assert.equal(totals.linked_accounts,0);assert.equal(totals.invitations,0);assert.equal(totals.mail,0);console.log(JSON.stringify({independentDatabaseVerification:totals}));}finally{await verify.end();}}
 if(process.argv.includes('--http') || process.argv.includes('--http-only')) {
  await mkdir('.local',{recursive:true});
  await writeFile('.local/member-jobs-test.env',Object.entries(env).filter(([,v])=>v!==undefined).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n'),{mode:0o600});
  await run(['--import','tsx','scripts/test-member-import-jobs-http.mts']);
 }
}finally{await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await root.end();console.log('Removed isolated jobs database');}
