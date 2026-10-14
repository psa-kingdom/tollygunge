import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { databaseOptions } from '../src/lib/database-options';

// Production inspection only: the database enforces a read-only snapshot.
const out='.local/live-product';
await mkdir(out,{recursive:true});
const pool=new Pool(databaseOptions());
const client=await pool.connect();
try {
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const identity=(await client.query('SELECT current_database() name')).rows[0];
 if(identity.name!==process.env.TPA_DATABASE_NAME) throw Error('Database identity mismatch');
 const migrations=(await client.query('SELECT name,checksum,applied_at FROM public.tpa_migrations ORDER BY name')).rows;
 const tables=(await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='tpa' AND table_type='BASE TABLE' ORDER BY table_name")).rows;
 const counts:Record<string,number>={};
 for(const {table_name} of tables) counts[table_name]=Number((await client.query('SELECT count(*) n FROM tpa."'+table_name.replaceAll('"','""')+'"')).rows[0].n);
 counts.accounts=Number((await client.query('SELECT count(*) n FROM public."user"')).rows[0].n);
 const foreignKeys=(await client.query("SELECT conrelid::regclass::text source,confrelid::regclass::text target,conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE contype='f' AND connamespace='tpa'::regnamespace ORDER BY source,conname")).rows;
 const member=(await client.query('SELECT id,"emailVerified" FROM public."user" WHERE lower(email)=lower($1)',['savagesnowboy@gmail.com'])).rows;
 const content=(await client.query('SELECT id,slug,kind,published IS NOT NULL published,version FROM tpa.content_entries ORDER BY slug')).rows;
 const people=(await client.query("SELECT id,published->>'name' name,published IS NOT NULL published,published->>'portraitId' portrait_id FROM tpa.people WHERE published IS NOT NULL ORDER BY id")).rows;
 const holds=(await client.query('SELECT count(*)::int unreleased FROM tpa.account_invitation_holds WHERE released_at IS NULL')).rows[0];
 await client.query('COMMIT');
 const localMigrations=[];
 for(const name of (await readdir('migrations')).filter(n=>n.endsWith('.sql')).sort()) {const sql=await readFile('migrations/'+name,'utf8');localMigrations.push({name,checksum:createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex')});}
 const status=JSON.parse(execFileSync(process.execPath,['C:/Users/savag/AppData/Roaming/npm/node_modules/@railway/cli/bin/railway.js','status','--json'],{stdio:['ignore','pipe','pipe']}).toString());
 type Service={node:{serviceName:string;latestDeployment?:{id:string;status:string;createdAt:string;meta?:{cliMessage?:string;imageDigest?:string}}}};
 type Environment={node:{name:string;serviceInstances:{edges:Service[]}}};
 const hosted=status.environments.edges.map((e:Environment)=>({name:e.node.name,services:e.node.serviceInstances.edges.map((s:Service)=>({name:s.node.serviceName,deployment:s.node.latestDeployment?.id,status:s.node.latestDeployment?.status,createdAt:s.node.latestDeployment?.createdAt,message:s.node.latestDeployment?.meta?.cliMessage,imageDigest:s.node.latestDeployment?.meta?.imageDigest}))}));
 const variables=JSON.parse(execFileSync(process.execPath,['C:/Users/savag/AppData/Roaming/npm/node_modules/@railway/cli/bin/railway.js','variables','--json','--service','tpa-web','--environment','production'],{stdio:['ignore','pipe','pipe']}).toString());
 const config={flags:Object.fromEntries(['ONBOARDING_ENABLED','EMAIL_OPERATIONS_ENABLED','EVENT_REMINDERS_ENABLED','EVENT_PROMOTIONS_ENABLED','MEMBER_IMPORT_WORKER_ENABLED','RESEND_DOMAIN_VERIFIED','TPA_MAIL_SINK'].map(key=>[key,variables[key]??'unset'])),configured:Object.fromEntries(['DATABASE_URL','BETTER_AUTH_SECRET','RESEND_API_KEY','RESEND_RECEIVING_API_KEY','RESEND_WEBHOOK_SECRET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME'].map(key=>[key,Boolean(variables[key])]))};
 const evidence={checked:new Date().toISOString(),readOnly:true,identity,migrations,localMigrations,counts,foreignKeys,memberExists:member.length===1,memberEmailVerified:member[0]?.emailVerified,content,people,holds,hosted,config};
 await writeFile(out+(process.argv.includes('--final')?'/baseline-final.json':'/baseline.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({checked:evidence.checked,readOnly:true,accounts:counts.accounts,people:counts.people,events:counts.events,migrations:migrations.length,memberExists:evidence.memberExists,holds,hosted}));
} catch {throw Error('Live baseline inspection failed; sensitive diagnostics withheld');}
finally {client.release();await pool.end();}
