import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import pg from 'pg';
await mkdir('.local/paper-v3-correction',{recursive:true});
const rootUrl=new URL(process.env.DATABASE_URL??'postgresql://tpa_qa@127.0.0.1:55439/postgres');
if (!['127.0.0.1','localhost','[::1]'].includes(rootUrl.hostname) || !['postgres:','postgresql:'].includes(rootUrl.protocol)) throw Error('Newsletter tests require loopback PostgreSQL');
rootUrl.pathname='/postgres';
const root=new pg.Pool({connectionString:rootUrl.href,ssl:false});
const name='tpa_onboarding_test_public_'+randomUUID().replaceAll('-','');
rootUrl.pathname='/'+name;
const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,USERPROFILE:process.env.USERPROFILE,DATABASE_URL:rootUrl.href,DATABASE_SSL:'false',TPA_DATABASE_NAME:name,BETTER_AUTH_URL:'http://127.0.0.1:3170',BETTER_AUTH_SECRET:'synthetic-public-subscription-secret-32-characters',ONBOARDING_ENABLED:'true',TPA_MAIL_SINK:'true'};
const results=[];async function run(label,args){const code=await new Promise((resolve,reject)=>{const c=spawn(process.execPath,args,{env,stdio:'inherit'});c.on('error',reject);c.on('exit',resolve);});results.push({label,code});if(code)throw Error(label+' failed');}
try{await root.query(`CREATE DATABASE ${name}`);await run('migrations',['scripts/migrate.mjs']);await run('newsletter-and-regressions',['--import','tsx','--test','--test-concurrency=1','tests/public-newsletter.integration.ts','tests/email.integration.ts','tests/identity.integration.ts']);}
finally{await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);if((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)throw Error('Disposable database was not removed');await root.end();await writeFile('.local/paper-v3-correction/backend-results.json',JSON.stringify({results,cleanup:true,externalProviders:false},null,2));}
