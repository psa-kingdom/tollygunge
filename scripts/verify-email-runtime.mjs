// Disposable-database acceptance only. No provider calls or business sends.
import {spawn} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
import {cp,copyFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';import {Pool} from 'pg';
import {databaseOptions} from '../src/lib/database-options.ts';
if(!/(?:ci|acceptance|test)/.test(process.env.TPA_DATABASE_NAME||''))throw Error('Use a disposable test database.');
const directory=await mkdtemp(join(tmpdir(),'tpa-email-runtime-'));const pool=new Pool(databaseOptions());let first,second,previous;
async function stop(child){if(!child||child.exitCode!==null)return;const done=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await Promise.race([done,wait(10000)]);if(child.exitCode===null)child.kill('SIGKILL');}
try{
 previous=(await pool.query("SELECT * FROM tpa.email_worker_state WHERE id='email'")).rows[0];
 await cp('.next/standalone',directory,{recursive:true,dereference:true});await copyFile('.next/email-worker.mjs',join(directory,'email-worker.mjs'));
 const env={...process.env,EMAIL_OPERATIONS_ENABLED:'false',ONBOARDING_ENABLED:'false'};
 const launch=()=>{const c=spawn(process.execPath,['email-worker.mjs'],{cwd:directory,env,stdio:'pipe'});c.stdout.resume();c.stderr.resume();return c;};
 first=launch();await wait(6000);if(first.exitCode!==null)throw Error('Standalone worker failed to start.');second=launch();await wait(3000);await stop(first);const stopped=Date.now();await wait(13000);const row=(await pool.query("SELECT heartbeat_at FROM tpa.email_worker_state WHERE id='email'")).rows[0];if(second.exitCode!==null||!row||new Date(row.heartbeat_at).getTime()<stopped)throw Error('Rolling worker handover failed.');console.log('PASS standalone worker dependencies and rolling leadership handover');
}finally{
 await stop(first);await stop(second);
 if(previous)await pool.query("UPDATE tpa.email_worker_state SET heartbeat_at=$1,status=$2,quota=$3,quota_checked_at=$4 WHERE id='email'",[previous.heartbeat_at,previous.status,previous.quota,previous.quota_checked_at]);else await pool.query("DELETE FROM tpa.email_worker_state WHERE id='email'");await pool.end();
 if(!resolve(directory).startsWith(resolve(tmpdir())+sep))throw Error('Unexpected fixture directory.');await rm(directory,{recursive:true,force:true});
}
