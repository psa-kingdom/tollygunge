import assert from 'node:assert/strict';import{Pool}from'pg';import{spawnSync}from'node:child_process';
import{localIdentity,runtimeEnvironment}from'./rehearse-roles.mjs';import{tablePermissions,columnPermissions,sequencePermissions,quoteObject as qo,quoteIdentifier as q}from'./database-permissions.mjs';
export async function verifyRoles(env){
 const {roles}=localIdentity(env),results=[];
 for(const kind of ['web','email','import']){
  const scoped=runtimeEnvironment(env,kind),p=new Pool({connectionString:scoped.DATABASE_URL,ssl:false,max:1});
  try{
   const role=(await p.query('SELECT current_user name,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.equal(role.name,roles[kind]);for(const [k,v]of Object.entries(role))if(k!=='name')assert.equal(v,false);
   assert.equal((await p.query('SELECT count(*)::int n FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)')).rows[0].n,0);
   assert.equal((await p.query("SELECT count(*)::int n FROM pg_class WHERE relnamespace IN ('public'::regnamespace,'tpa'::regnamespace) AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)")).rows[0].n,0);
   const sequences=(await p.query("SELECT n.nspname schema,c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','tpa') AND c.relkind='S'")).rows;
   for(const seq of sequences)for(const verb of ['USAGE','SELECT','UPDATE']){const name=seq.schema+'.'+seq.name;assert.equal((await p.query('SELECT has_sequence_privilege(current_user,$1,$2) allowed',[qo(name),verb])).rows[0].allowed,verb==='USAGE'&&sequencePermissions[kind].includes(name));}
   const tables=(await p.query("SELECT n.nspname schema,c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','tpa') AND c.relkind IN ('r','p')")).rows;
   let checked=0;for(const t of tables)for(const verb of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']){
    const name=t.schema+'.'+t.name,expected=tablePermissions[kind][name]?.includes(verb)||false;
    const actual=(await p.query('SELECT has_table_privilege(current_user,$1,$2) allowed',[qo(name),verb])).rows[0].allowed;assert.equal(actual,expected,kind+' '+name+' '+verb);checked++;
   }
   let denied=0;for(const sql of ["CREATE TABLE public.forbidden_runtime(id int)","CREATE SCHEMA forbidden_runtime","CREATE ROLE forbidden_runtime","CREATE TEMP TABLE forbidden_runtime(id int)",`SET ROLE ${q(roles.migration)}`,`ALTER TABLE tpa.people OWNER TO ${q(roles[kind])}`,"TRUNCATE tpa.people","DROP TABLE tpa.people","SELECT * FROM public.tpa_migrations"]){await assert.rejects(p.query(sql),e=>['42501'].includes(e.code));denied++;}
   for(const [table,verbs]of Object.entries(columnPermissions[kind]))for(const columns of Object.values(verbs))for(const column of columns)assert.equal((await p.query("SELECT has_column_privilege(current_user,$1,$2,'UPDATE') allowed",[qo(table),column])).rows[0].allowed,true);
   if(kind!=='web'){const columns=(await p.query("SELECT table_schema,table_name,column_name FROM information_schema.columns WHERE table_schema IN ('public','tpa')")).rows;for(const col of columns){const table=col.table_schema+'.'+col.table_name,expected=tablePermissions[kind][table]?.includes('UPDATE')||columnPermissions[kind][table]?.UPDATE?.includes(col.column_name)||false;assert.equal((await p.query("SELECT has_column_privilege(current_user,$1,$2,'UPDATE') allowed",[qo(table),col.column_name])).rows[0].allowed,expected,kind+' '+table+'.'+col.column_name);}}
   if(kind==='email'){await p.query('SELECT id FROM tpa.events WHERE false FOR SHARE');await p.query('SELECT id FROM tpa.event_registrations WHERE false FOR SHARE');await p.query('SELECT id FROM tpa.public_subscribers WHERE false');await p.query('SELECT token_hash FROM tpa.public_subscription_tokens WHERE false');for(const sql of ['UPDATE tpa.events SET fee_paise=0 WHERE false',"UPDATE tpa.public_subscribers SET status='confirmed' WHERE false",'SELECT * FROM tpa.public_subscription_requests'])await assert.rejects(p.query(sql),e=>e.code==='42501');}
   if(kind==='import'){await p.query('SELECT id FROM public."user" WHERE false FOR UPDATE');await assert.rejects(p.query('UPDATE public."user" SET email=email WHERE false'),e=>e.code==='42501');}
   await assert.rejects(p.query('CREATE DATABASE forbidden_runtime'),e=>e.code==='42501');denied++;
   const run=spawnSync(process.execPath,['scripts/migrate.mjs'],{env:scoped,stdio:'pipe',timeout:10000});assert.notEqual(run.status,0);assert.match(String(run.stderr),/permission denied/);
   if(kind!=='web'){for(const sql of ['SELECT * FROM public.account','SELECT * FROM public.session','SELECT * FROM tpa.private_documents','UPDATE tpa.event_payment_history SET reference=reference WHERE false'])await assert.rejects(p.query(sql),e=>e.code==='42501');denied+=4;}
   results.push({kind,identityVerified:true,checkedTablePrivileges:checked,negativeStatementsDenied:denied,migrationDenied:true});
  }finally{await p.end();}
 }
 return results;
}
