"use client";
import {useEffect,useState} from 'react';
import {api} from './operations-client';
type Job={id:string;state:string;total:number;processed:number;last_progress_at:string|null;totals:Record<string,number>;worker:{enabled:boolean;heartbeat_at:string}|null;rows:{sourceRow:number;status:string;attempts:number;result:{reason?:string}|null}[]};
export function MemberImportJobProgress({batchId,version}:{batchId:string;version:number}) {
 const [job,setJob]=useState<Job|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(0);
 useEffect(()=>{let active=true;async function load(){try{const response=await api<{job:Job|null}>('/api/staff/member-import-jobs?batchId='+encodeURIComponent(batchId));if(active){setJob(response.job);setError('');setNow(Date.now());}}catch(e){if(active)setError((e as Error).message);}}
  void load();const interval=setInterval(()=>void load(),5000);return()=>{active=false;clearInterval(interval);};},[batchId]);
 async function action(retry=false){setBusy(true);try{const result=await api<{id:string}>('/api/staff/member-import-jobs',retry?{action:'retry',id:job?.id}:{action:'enqueue',batchId,version});setJob(await api<Job>('/api/staff/member-import-jobs?id='+result.id));setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section aria-label="Saved member import progress">
  <p>Import creates people and memberships. It sends no invitations and creates no login accounts. Missing districts and conflicting records remain held.</p>
  {!job && <button className="button" disabled={busy} onClick={()=>void action()}>Start reviewed member import</button>}
  {error && <p role="alert">{error}</p>}
  {job && <><p role="status">{job.state}: {job.processed} of {job.total} records processed. You can leave this page and return to the saved batch.</p>
   <progress aria-label="Member import progress" value={job.processed} max={job.total||1}/>
   {['queued','running'].includes(job.state) && (!job.worker?.enabled || now-new Date(job.worker.heartbeat_at).getTime()>30000) && <p>Processing is waiting for the import worker. Saved records are safe.</p>}
   <p>Created: {job.totals.created??0} · Skipped: {job.totals.skipped??0} · Conflicts: {job.totals.conflict??0} · Invalid: {job.totals.invalid??0} · Failed: {job.totals.failed??0} · Retrying: {job.totals.retry??0}</p>
   {job.last_progress_at && <p>Last progress: {new Date(job.last_progress_at).toLocaleString()}</p>}
   {['completed-with-issues','paused'].includes(job.state) && job.totals.failed>0 && <button className="button" disabled={busy} onClick={()=>void action(true)}>Retry temporary failures</button>}
   <ul>{job.rows.map(row=><li key={row.sourceRow}>Source row {row.sourceRow}: {row.status}{row.result?.reason?' — '+row.result.reason:''}{row.attempts>1?' · Attempts: '+row.attempts:''}</li>)}</ul>
  </>}
 </section>;
}
