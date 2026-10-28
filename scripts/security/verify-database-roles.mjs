import assert from'node:assert/strict';import{Pool}from'pg';import{randomUUID}from'node:crypto';import{spawnSync}from'node:child_process';import{mkdir,writeFile}from'node:fs/promises';
import{provision,localIdentity,rehearsalRoleUrl}from'./rehearse-roles.mjs';import{verifyRoles}from'./verify-role-permissions.mjs';import{quoteIdentifier as q}from'./database-permissions.mjs';
const rootUrl=new URL(process.env.DATABASE_URL||'');assert.equal(rootUrl.protocol,'postgresql:');assert.equal(rootUrl.hostname,'127.0.0.1');assert.equal(rootUrl.port,'55439');assert.equal(rootUrl.pathname,'/postgres');assert.ok(['tpa_qa','postgres'].includes(rootUrl.username));
assert.ok(!rootUrl.search&&!rootUrl.hash,'Connection options are forbidden in local acceptance');
const root=new Pool({connectionString:rootUrl.href,ssl:false,max:1});const out=process.env.TPA_SECURITY_OUTPUT||'.local/phase7b';await mkdir(out,{recursive:true});const results=[],cleanupResults=[];let cleanupComplete=true;
try{for(const mode of ['fresh','upgrade']){
 const name='tpa_security_test_'+randomUUID().replaceAll('-',''),url=new URL(rootUrl);url.pathname='/'+name;
 const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,DATABASE_URL:url.href,DATABASE_SSL:'false',TPA_DATABASE_NAME:name};const {roles}=localIdentity(env);
 let created=false;
 try{
  await root.query(`CREATE DATABASE ${q(name)}`);created=true;cleanupComplete=false;
  const migrate=(identity,through)=>{const connection=identity==='migration'?rehearsalRoleUrl(env,'migration'):url.href;const run=spawnSync(process.execPath,['scripts/migrate.mjs',...(through?['--through',through]:[])],{env:{...env,DATABASE_URL:connection},encoding:'utf8',timeout:30000});assert.equal(run.status,0,'Controlled '+mode+' migration failed: '+String(run.stderr).slice(0,1000));};
  if(mode==='upgrade')migrate('admin','029');
  await provision(env,{empty:true});migrate('migration');migrate('migration');await provision(env);
  const db=new Pool({connectionString:url.href,ssl:false});try{await db.query('CREATE TABLE tpa.future_permission_probe(id integer)');}finally{await db.end();}
  const checks=await verifyRoles(env);results.push({mode,passed:true,checks,migrationIdentitySeparate:true,migrationsRepeatable:true});
 }finally{
  if(created){
   // All owned pools have ended. Wait for their backends to disconnect instead
   // of force-terminating closing clients and racing idle pool error delivery.
   let connections=0;
   for(let attempt=0;attempt<100;attempt++){
    connections=(await root.query('SELECT count(*)::int n FROM pg_stat_activity WHERE datname=$1',[name])).rows[0].n;
    if(connections===0)break;
    await new Promise(resolve=>setTimeout(resolve,50));
   }
   assert.equal(connections,0,'Owned fixture connections must close before database retirement');
   await root.query(`DROP DATABASE ${q(name)}`);
   for(const role of Object.values(roles)){if((await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`DROP ROLE ${q(role)}`);}
   const databases=(await root.query('SELECT count(*)::int n FROM pg_database WHERE datname=$1',[name])).rows[0].n;
   const remainingRoles=(await root.query('SELECT count(*)::int n FROM pg_roles WHERE rolname=ANY($1::text[])',[Object.values(roles)])).rows[0].n;
   assert.equal(databases,0);assert.equal(remainingRoles,0);cleanupResults.push({mode,remainingDatabases:databases,remainingRoles});cleanupComplete=true;
  }
 }
}}finally{await root.end();await writeFile(out+'/role-acceptance.json',JSON.stringify({results,cleanup:cleanupComplete,cleanupResults,completed:new Date().toISOString()},null,2));}
console.log(JSON.stringify({passed:results.length===2,modes:results.map(r=>r.mode),cleanup:cleanupComplete}));
