import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {spawn} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {databaseOptions} from '../src/lib/database-options';
import {memberHeaders,correctionMemberHeaders} from '../src/domain/member-import';
import ExcelJS from 'exceljs';
assert.ok(process.env.TPA_DATABASE_NAME?.startsWith('tpa_onboarding_test_jobs_'));
const pool=new Pool(databaseOptions()),base=process.env.TPA_TEST_URL!,actor=randomUUID(),ordinary=randomUUID(),reviewer=randomUUID(),cookies:string[]=[];
const env={...process.env,MEMBER_IMPORT_WORKER_ENABLED:'true'};
const workerBundle=process.env.TPA_JOB_WORKER_BUNDLE??'.next/member-import-worker.mjs';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3140'],{env,stdio:'inherit'});
let worker:ReturnType<typeof spawn>|undefined;
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const post=(data:unknown,cookie=cookies[0],origin=base)=>fetch(base+'/api/staff/member-import-jobs',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:origin},body:JSON.stringify(data)});
try {
 let ready=false;for(let n=0;n<60;n++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(ready)break;await wait(1000);}assert.ok(ready);
 for(const [index,id]of [actor,ordinary,reviewer].entries()){
  await pool.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Synthetic HTTP operator\',$2,true)',[id,id+'@example.invalid']);
  const token=randomBytes(32).toString('hex');await pool.query('INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',[randomUUID(),token,id]);
  cookies[index]='better-auth.session_token='+encodeURIComponent(token+'.'+createHmac('sha256',process.env.BETTER_AUTH_SECRET!).update(token).digest('base64'));
 }
 await pool.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator'),($2,'membership_reviewer')",[actor,reviewer]);
 assert.equal((await fetch(base+'/api/staff/member-import-jobs')).status,401);
 assert.equal((await post({action:'enqueue'},cookies[1])).status,403);assert.equal((await post({action:'enqueue'},cookies[2])).status,403);
 assert.equal((await post({action:'enqueue'},cookies[0],'https://example.invalid')).status,403);
 const prefix=randomUUID(),cells=[memberHeaders,...Array.from({length:10},(_,i)=>['CA','HTTP','Member'+i,prefix+'-'+String(i).padStart(5,'0'),prefix+'-'+i+'@example.invalid','9876543210','','','','','','',''])];
 const csv=cells.map(r=>r.join(',')).join('\n'),form=new FormData();form.set('file',new File([csv],'synthetic.csv',{type:'text/csv'}));
 const previewResponse=await fetch(base+'/api/staff/member-import-jobs',{method:'POST',headers:{Cookie:cookies[0],Origin:base},body:form});assert.equal(previewResponse.status,200);const preview=await previewResponse.json();assert.equal(preview.rows.length,10);
 assert.equal((await post({action:'enqueue',batchId:preview.id,version:1,provisionAccounts:true})).status,400);
 assert.equal((await post({action:'enqueue',batchId:preview.id,version:0})).status,409);
 const before=(await pool.query(`SELECT (SELECT count(*) FROM tpa.memberships) members,(SELECT count(*) FROM public."user") accounts,(SELECT count(*) FROM tpa.onboarding_invitations) invitations,(SELECT count(*) FROM tpa.onboarding_mail) mail`)).rows[0];
 const start=Date.now();const queued=await post({action:'enqueue',batchId:preview.id,version:1});assert.equal(queued.status,202);const job=await queued.json();const enqueueMs=Date.now()-start;assert.ok(enqueueMs<15000,'Enqueue must not process rows');
 assert.equal((await pool.query('SELECT count(*) FROM tpa.memberships')).rows[0].count,before.members);
 assert.equal((await (await post({action:'enqueue',batchId:preview.id,version:1})).json()).id,job.id);
 // Disconnect an idempotent enqueue request immediately after headers, then process without the browser.
 await new Promise<void>((resolve,reject)=>{const request=httpRequest(base+'/api/staff/member-import-jobs',{method:'POST',headers:{Cookie:cookies[0],Origin:base,'Content-Type':'application/json'}},response=>{assert.equal(response.statusCode,202);response.destroy();resolve();});request.on('error',error=>{if((error as {code?:string}).code!=='ECONNRESET')reject(error);});request.end(JSON.stringify({action:'enqueue',batchId:preview.id,version:1}));});
 worker=spawn(process.execPath,[workerBundle],{env,stdio:'inherit'});
 let finished=false,restarted=false;
 for(let n=0;n<180;n++){if(worker.exitCode!==null)throw Error('Compiled import worker exited before completion');const status=await (await fetch(base+'/api/staff/member-import-jobs?id='+job.id,{headers:{Cookie:cookies[0]}})).json();if(!restarted && status.processed>=5 && status.processed<10){worker.kill('SIGKILL');await new Promise(resolve=>worker!.once('exit',resolve));await pool.query("UPDATE tpa.member_import_jobs SET lease_until=now()-interval '1 second' WHERE id=$1 AND state='running'",[job.id]);worker=spawn(process.execPath,[workerBundle],{env,stdio:'inherit'});restarted=true;}
  if(String(status.state).startsWith('completed')){assert.equal(status.totals.created,10);finished=true;break;}await wait(1000);}
 assert.ok(finished,'Independent worker did not complete');
 const after=(await pool.query(`SELECT (SELECT count(*) FROM tpa.memberships) members,(SELECT count(*) FROM public."user") accounts,(SELECT count(*) FROM tpa.onboarding_invitations) invitations,(SELECT count(*) FROM tpa.onboarding_mail) mail`)).rows[0];
 assert.equal(Number(after.members),Number(before.members)+10);for(const key of ['accounts','invitations','mail'])assert.equal(after[key],before[key]);
 const exported=await (await fetch(base+'/api/staff/member-import-jobs?correctionBatchId='+preview.id,{headers:{Cookie:cookies[0]}})).json();assert.deepEqual(exported.headers,correctionMemberHeaders);
 // Filtered correction retains original physical row 11 rather than being renumbered to row 2.
 const correctedForm=new FormData();correctedForm.set('parentBatchId',preview.id);correctedForm.set('file',new File([[exported.headers,exported.rows[9]].map((r:string[])=>r.join(',')).join('\n')],'corrected.csv',{type:'text/csv'}));
 const corrected=await fetch(base+'/api/staff/member-import-jobs',{method:'POST',headers:{Cookie:cookies[0],Origin:base},body:correctedForm});assert.equal(corrected.status,200);const correctedPreview=await corrected.json();assert.equal(correctedPreview.rows[0].sourceRow,11);
 assert.equal(correctedPreview.rows[0].status,'skipped');
 const correctionWorkbook=new ExcelJS.Workbook();
 const correctionSheet=correctionWorkbook.addWorksheet('Corrections');correctionSheet.addRow(exported.headers);correctionSheet.addRow(exported.rows[9]);
 for(const name of ['Summary','Issues','Originals'])correctionWorkbook.addWorksheet(name).addRow(['Synthetic retained context']);
 const xlsxForm=new FormData();xlsxForm.set('parentBatchId',preview.id);xlsxForm.set('file',new File([new Uint8Array(await correctionWorkbook.xlsx.writeBuffer())],'correction.xlsx'));
 const xlsxResponse=await fetch(base+'/api/staff/member-import-jobs',{method:'POST',headers:{Cookie:cookies[0],Origin:base},body:xlsxForm});assert.equal(xlsxResponse.status,200);
 const xlsxPreview=await xlsxResponse.json();assert.equal(xlsxPreview.rows[0].sourceRow,11);assert.equal(xlsxPreview.rows[0].status,'skipped');
 if(process.env.TPA_JOB_BROWSER==='true') {
  const code=await new Promise((resolve,reject)=>{const browser=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','tests/browser/member-import-jobs.spec.ts','--project=desktop','--project=tablet','--project=phone','--output=.local/member-job-browser-artifacts'],{env,stdio:'inherit'});browser.on('error',reject);browser.on('exit',resolve);});assert.equal(code,0,'Worker-backed browser acceptance failed');
 }
 assert.ok(restarted,'Test must interrupt and restart the actual worker between chunks');
 console.log(JSON.stringify({http:'passed',created:10,enqueueMs,disconnectedClientSafe:true,workerRestarted:true,correctionSourceRow:11,invitationsSent:0}));
}finally{
 for(const child of [worker,server])if(child && child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
 await pool.end();
}
