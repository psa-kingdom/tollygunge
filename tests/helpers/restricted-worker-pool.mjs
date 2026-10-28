import assert from'node:assert/strict';import{Pool}from'pg';
import{provision,runtimeEnvironment,localIdentity}from'../../scripts/security/rehearse-roles.mjs';
/** Fixture creation/assertions stay on admin; only worker business operations switch. */
export async function restrictedWorkerPool(fixture,env,kind){
 if(env.TPA_RESTRICTED_ROLE_TESTS!=='true')return fixture;
 await provision(env);const scoped=runtimeEnvironment(env,kind),p=new Pool({connectionString:scoped.DATABASE_URL,ssl:false,max:3});
 assert.equal((await p.query('SELECT current_user name')).rows[0].name,localIdentity(env).roles[kind]);return p;
}
