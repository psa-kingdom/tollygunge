import {Pool} from 'pg';import {randomUUID} from 'node:crypto';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';import {databaseOptions} from '../src/lib/database-options';
const name='tpa_onboarding_test_invitations_'+randomUUID().replaceAll('-','').slice(0,24),root=new Pool(databaseOptions()),url=new URL(process.env.DATABASE_URL!);url.pathname='/'+name;
const env={...process.env,DATABASE_URL:url.toString(),TPA_DATABASE_NAME:name,ONBOARDING_ENABLED:'true',TPA_MAIL_SINK:'true',SMTP_HOST:'',SMTP_PASSWORD:'',RESEND_API_KEY:'',RESEND_RECEIVING_API_KEY:'',R2_ACCESS_KEY_ID:'',R2_SECRET_ACCESS_KEY:'',BETTER_AUTH_URL:'http://127.0.0.1:3142',BETTER_AUTH_SECRET:'synthetic-invitation-release-secret-at-least-32',TPA_TEST_URL:'http://127.0.0.1:3142',TPA_BROWSER_CHANNEL:'chrome'};
async function run(args:string[]){const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{env,stdio:'inherit'});p.on('error',reject);p.on('exit',resolve);});assert.equal(code,0);}
try{await root.query(`CREATE DATABASE ${name}`);console.log('Created isolated invitation database',name);await run(['scripts/migrate.mjs','--through','028']);
 const old=new Pool(databaseOptions(env)),legacy=randomUUID();try{await old.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Legacy held account\',$2,false)',[legacy,legacy+'@example.invalid']);await old.query('INSERT INTO tpa.account_invitation_holds(user_id) VALUES($1)',[legacy]);}finally{await old.end();}
 await run(['scripts/migrate.mjs']);await run(['scripts/migrate.mjs']);
 const verify=new Pool(databaseOptions(env));try{assert.equal((await verify.query('SELECT version FROM tpa.account_invitation_holds WHERE user_id=$1',[legacy])).rows[0].version,1);}finally{await verify.end();}
 if(process.argv.includes('--http'))await run(['--import','tsx','scripts/test-invitation-release-http.mts']);
 else await run(['--conditions=react-server','--import','tsx','--test','tests/invitation-release.integration.ts']);
}finally{await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await root.end();console.log('Removed isolated invitation database');}
