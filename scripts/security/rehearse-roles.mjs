/** LOCAL ONLY. No production role, ownership or PUBLIC permission changes. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {tablePermissions,columnPermissions,sequencePermissions,quoteIdentifier as q,quoteObject as qo} from './database-permissions.mjs';
export function localIdentity(env){
 const u=new URL(env.DATABASE_URL||'');assert.equal(u.protocol,'postgresql:');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'55439');
 assert.ok(!u.search&&!u.hash,'Connection option overrides are forbidden in local rehearsal');
 const name=decodeURIComponent(u.pathname.slice(1));assert.equal(name,env.TPA_DATABASE_NAME);
 assert.match(name,/^tpa_(?:onboarding_test_|member_test_|event_test_|engagement_test_|website_test_|acceptance_|security_test_)[a-z0-9_]+$/);
 assert.ok(['tpa_qa','postgres'].includes(decodeURIComponent(u.username)));assert.equal(env.DATABASE_SSL,'false');
 const prefix='tpa7b_'+createHash('sha256').update(name).digest('hex').slice(0,16);
 return {u,name,roles:Object.fromEntries(['web','email','import','migration'].map(k=>[k,prefix+'_'+k]))};
}
export function runtimeEnvironment(env,kind){
 assert.ok(['web','email','import'].includes(kind));
 const result={...env,DATABASE_URL:rehearsalRoleUrl(env,kind)};for(const key of ['TPA_EMAIL_DATABASE_URL','TPA_IMPORT_DATABASE_URL','TPA_MIGRATION_DATABASE_URL'])delete result[key];return result;
}
function fixturePassword(name,kind){return createHash('sha256').update('synthetic-disposable-only:'+name+':'+kind).digest('hex');}
export function rehearsalRoleUrl(env,kind){const {u,name,roles}=localIdentity(env);assert.ok(Object.hasOwn(roles,kind));u.username=roles[kind];u.password=fixturePassword(name,kind);return u.href;}
export async function provision(env,{empty=false}={}){
 const {u,name,roles}=localIdentity(env),p=new Pool({connectionString:u.href,ssl:false,max:1});const c=await p.connect();
 try{
  assert.equal((await c.query('SELECT current_database() name')).rows[0].name,name);
  assert.equal((await c.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0].rolsuper,true);
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(74672701)');
  for(const [kind,role] of Object.entries(roles)){
   const old=(await c.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1',[role])).rows[0];
   if(old)assert.ok(Object.values(old).every(v=>v===false),'Unexpected rehearsal role attributes');
   else await c.query(`CREATE ROLE ${q(role)} LOGIN PASSWORD '${fixturePassword(name,kind)}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`);
   assert.equal((await c.query('SELECT count(*)::int n FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)',[role])).rows[0].n,0,'Unexpected role memberships');
  }
  // Scope PUBLIC changes to this newly-created disposable database only.
  await c.query(`REVOKE CONNECT,TEMPORARY ON DATABASE ${q(name)} FROM PUBLIC`);
  await c.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await c.query(`GRANT CONNECT,CREATE ON DATABASE ${q(name)} TO ${q(roles.migration)}`);
  await c.query(`GRANT USAGE,CREATE ON SCHEMA public TO ${q(roles.migration)}`);
  const objects=(await c.query("SELECT n.nspname schema,c.relname name,c.relkind kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','tpa') AND c.relkind IN ('r','p','S') ORDER BY (c.relkind='S'),c.relname")).rows;
  if(!empty)assert.ok(objects.some(r=>r.name==='website_settings'),'All source migrations must be applied first');
  if(!empty)for(const o of objects.filter(o=>o.kind!=='S'&&o.name!=='tpa_migrations'))assert.ok(tablePermissions.web[o.schema+'.'+o.name],'New application objects require explicit permission-manifest review');
  assert.equal((await c.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','tpa') AND p.prosecdef")).rows[0].n,0,'Security-definer functions require separate privilege review');
  if(objects.some(o=>o.schema==='tpa')){
   await c.query(`ALTER SCHEMA tpa OWNER TO ${q(roles.migration)}`);
   for(const o of objects)await c.query(`ALTER ${o.kind==='S'?'SEQUENCE':'TABLE'} ${qo(o.schema+'.'+o.name)} OWNER TO ${q(roles.migration)}`);
  }
  for(const kind of ['web','email','import']){
   const role=q(roles[kind]);await c.query(`GRANT CONNECT ON DATABASE ${q(name)} TO ${role}`);
   await c.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
   if(!empty){await c.query(`GRANT USAGE ON SCHEMA tpa TO ${role}`);
    await c.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public,tpa FROM ${role}`);await c.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public,tpa FROM ${role}`);
    const columns=(await c.query("SELECT n.nspname schema,c.relname name,a.attname column FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','tpa') AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL")).rows;
    for(const col of columns)await c.query(`REVOKE ALL (${q(col.column)}) ON ${qo(col.schema+'.'+col.name)} FROM ${role}`);
    for(const [table,verbs]of Object.entries(tablePermissions[kind])){
     assert.ok(objects.some(o=>o.schema+'.'+o.name===table),'Manifest references a missing table');assert.ok(verbs.every(v=>['SELECT','INSERT','UPDATE','DELETE'].includes(v)));
     await c.query(`GRANT ${verbs.join(',')} ON TABLE ${qo(table)} TO ${role}`);
    }
    for(const seq of sequencePermissions[kind])await c.query(`GRANT USAGE ON SEQUENCE ${qo(seq)} TO ${role}`);
    for(const [table,verbs]of Object.entries(columnPermissions[kind]))for(const [verb,columns]of Object.entries(verbs))await c.query(`GRANT ${verb} (${columns.map(q).join(',')}) ON ${qo(table)} TO ${role}`);
   }
  }
  await c.query('COMMIT');
  const result={database:name,roles,localOnly:true,passwords:'Synthetic deterministic disposable-fixture values only; supports local trust/SCRAM and is forbidden for production',objects:objects.length,empty};
  if(env.TPA_ROLE_EVIDENCE_DIR){await mkdir(env.TPA_ROLE_EVIDENCE_DIR,{recursive:true});await writeFile(env.TPA_ROLE_EVIDENCE_DIR+'/'+name+'.json',JSON.stringify(result,null,2));}
  return result;
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();await p.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 provision(process.env,{empty:process.argv.includes('--empty')}).then(()=>console.log('Local restricted identities provisioned; no credentials emitted.')).catch(error=>{console.error('Local role setup failed:',error.code||error.message);process.exitCode=1;});
}
