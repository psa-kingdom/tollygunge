import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createAuth } from '../src/lib/auth-options';
import { hashPassword } from 'better-auth/crypto';
mkdirSync('.local/paper-v3',{recursive:true});
const root=new Pool({connectionString:'postgresql://tpa_qa@127.0.0.1:55439/postgres',ssl:false});
const name='tpa_onboarding_test_v3_'+randomUUID().replaceAll('-','');
const url='postgresql://tpa_qa@127.0.0.1:55439/'+name;let db:Pool|undefined;const results:string[]=[];
try {
 await root.query(`CREATE DATABASE ${name}`);
 const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,USERPROFILE:process.env.USERPROFILE,DATABASE_URL:url,DATABASE_SSL:'false',TPA_DATABASE_NAME:name,BETTER_AUTH_URL:'http://127.0.0.1:3170',BETTER_AUTH_SECRET:'synthetic-password-contract-32-characters',ONBOARDING_ENABLED:'true',TPA_MAIL_SINK:'true'};
 Object.assign(process.env,env);
 execFileSync(process.execPath,['scripts/migrate.mjs'],{env,stdio:'pipe'});
 db=new Pool({connectionString:url,ssl:false}); const auth=createAuth(db,env);
 const request=(path:string,body:object,cookie?:string)=>auth.handler(new Request(env.BETTER_AUTH_URL+'/api/auth'+path,{method:'POST',headers:{origin:env.BETTER_AUTH_URL,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)}));
 for(const path of ['/sign-up/email','/reset-password','/change-password']) for(const length of [5,13]) {
  const r=await request(path,{email:randomUUID()+'@example.invalid',name:'Boundary fixture',password:'x'.repeat(length),newPassword:'x'.repeat(length)});assert.equal(r.status,400);const payload=await r.json();assert.equal(payload.code,length===5?'PASSWORD_TOO_SHORT':'PASSWORD_TOO_LONG');results.push(`${path} rejects ${length}`);
 }
 for(const length of [6,12]) { const r=await request('/sign-up/email',{email:randomUUID()+'@example.invalid',name:'Synthetic boundary',password:'a'.repeat(length)});assert.equal(r.status,200);results.push(`signup accepts ${length}`); }
 const id=randomUUID(),email=id+'@example.invalid',long='Ab1!'.repeat(32);
 await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Legacy credential\',$2,true)',[id,email]);
 await db.query('INSERT INTO public."account"(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,\'credential\',$2,$3,now(),now())',[randomUUID(),id,await hashPassword(long)]);
 const login=await request('/sign-in/email',{email,password:long});assert.equal(login.status,200);results.push('128-character legacy login succeeds');
 const cookie=login.headers.get('set-cookie')!.split(';')[0];
 const change=await request('/change-password',{currentPassword:long,newPassword:'New!12',revokeOtherSessions:true},cookie);assert.equal(change.status,200);results.push('128-character current password changes to 6 characters');
 assert.equal((await request('/sign-in/email',{email,password:'New!12'})).status,200);results.push('replacement credential authenticates');
} finally {await db?.end();await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount,0);await root.end();writeFileSync('.local/paper-v3/password-integration.json',JSON.stringify({results,cleanup:true,externalProviders:false},null,2));}
console.log(`${results.length} password contract checks passed; disposable database removed`);
