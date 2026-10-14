import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {databaseOptions} from '../src/lib/database-options';
import {claimMemberJob,processMemberChunk} from '../src/lib/member-import-jobs';
const pool=new Pool({...databaseOptions(),max:3}),owner=randomUUID();let stopping=false;
for(const signal of ['SIGTERM','SIGINT'] as const) process.on(signal,()=>{stopping=true;});
const enabled=process.env.MEMBER_IMPORT_WORKER_ENABLED==='true';
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
try {while(!stopping){
 try{await pool.query("INSERT INTO tpa.member_import_worker_state(id,heartbeat_at,enabled) VALUES('member-import',now(),$1) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),enabled=EXCLUDED.enabled",[enabled]);
  if(enabled){const claim=await claimMemberJob(pool,owner);if(claim){
   const beat=setInterval(()=>void pool.query("UPDATE tpa.member_import_jobs SET heartbeat_at=now(),lease_until=now()+interval '2 minutes' WHERE id=$1 AND generation=$2 AND lease_owner=$3 AND state='running' AND lease_until>now()",[claim.id,claim.generation,owner]).catch(()=>{}),10000);
   try {const result=await processMemberChunk(pool,claim);console.log(JSON.stringify({event:'member_import_chunk',jobId:claim.id,...result}));}
   catch(error){if((error as {code?:string}).code==='member_job_policy') await pool.query("UPDATE tpa.member_import_jobs SET state='paused',lease_owner=NULL,lease_until=NULL WHERE id=$1 AND generation=$2 AND lease_owner=$3",[claim.id,claim.generation,owner]);else throw error;}
   finally {clearInterval(beat);}
  }}
 }catch{console.error('Member import worker unavailable; persisted jobs remain recoverable.');}
 await wait(enabled?1000:10000);
}}finally{await pool.end();}
