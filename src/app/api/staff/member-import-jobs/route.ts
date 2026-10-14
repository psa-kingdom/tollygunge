import {authorized,jsonBody,operation,transaction,OperationError} from '@/lib/operation-api';
import {getDatabase} from '@/lib/database';
import {enqueueMemberJob,getMemberJob,retryMemberJob} from '@/lib/member-import-jobs';
import {createHash} from 'node:crypto';
import {boundedBody} from '@/domain/request-body';
import {importCells} from '@/domain/onboarding-import';
import {createMemberPreview} from '@/lib/member-import';
import {diagnoseMembers} from '@/lib/member-import-diagnostic';
import {correctionMemberHeaders,extendedMemberHeaders} from '@/domain/member-import';
export async function GET(request:Request) {
 return operation(async()=>{const actor=await authorized(request,'staff:manage');const id=new URL(request.url).searchParams.get('id');
  const correctionBatchId=new URL(request.url).searchParams.get('correctionBatchId');
  if(correctionBatchId){const batch=(await getDatabase().query("SELECT rows,source_hash,choices FROM tpa.onboarding_batches WHERE id::text=$1 AND actor_id=$2 AND mode='members'",[correctionBatchId,actor.id])).rows[0];
   if(!batch || batch.choices?.approval) throw new OperationError('Strict member preview not found.',404);
   const hash=batch.choices?.correctionParent?.sourceHash??batch.source_hash;
   return {headers:correctionMemberHeaders,rows:batch.rows.map((row:{sourceRow:number;source:Record<string,string>})=>[...extendedMemberHeaders.map(h=>row.source[h]??''),String(row.sourceRow),hash])};}
  if(id) return getMemberJob(getDatabase(),actor.id,id);
  const batchId=new URL(request.url).searchParams.get('batchId');
  if(batchId){const job=(await getDatabase().query('SELECT id FROM tpa.member_import_jobs WHERE batch_id::text=$1 AND actor_id=$2 ORDER BY created_at DESC LIMIT 1',[batchId,actor.id])).rows[0];return {job:job?await getMemberJob(getDatabase(),actor.id,job.id):null};}
  return {jobs:(await getDatabase().query('SELECT id,batch_id,state,created_at,last_progress_at FROM tpa.member_import_jobs WHERE actor_id=$1 ORDER BY created_at DESC LIMIT 20',[actor.id])).rows};});
}
export async function POST(request:Request) {
 let accepted=false;
 const response=await operation(async()=>{const actor=await authorized(request,'staff:manage',true);
  if(request.headers.get('content-type')?.includes('multipart/form-data')) {
   const bytes=await boundedBody(request,5*1024*1024+65536),form=await new Response(bytes as BodyInit,{headers:{'Content-Type':request.headers.get('content-type')!}}).formData(),file=form.get('file');
   if(!(file instanceof File) || file.size>5*1024*1024) throw new OperationError('Choose a file up to 5 MB.');
   const content=new Uint8Array(await file.arrayBuffer()),cells=await importCells(content,file.name,{rowErrors:true,correctionWorkbook:true});
   return transaction(async c=>{
    const preview=await createMemberPreview(c,actor.id,cells,cells.sourceRows,cells.cellErrors,true);
    const corrected=preview.rows.filter(row=>row.source['Original Source Hash']);
    if(corrected.length){const parent=(await c.query("SELECT id,source_hash,rows,choices FROM tpa.onboarding_batches WHERE id::text=$1 AND actor_id=$2",[String(form.get('parentBatchId')??''),actor.id])).rows[0];
     const originalHash=parent?.choices?.correctionParent?.sourceHash??parent?.source_hash;
     if(!parent || corrected.length!==preview.rows.length || corrected.some(row=>row.source['Original Source Hash']!==originalHash || !parent.rows.some((original:{sourceRow:number})=>original.sourceRow===row.sourceRow))) throw new OperationError('Correction lineage does not match the selected original preview.',409,'correction_lineage');
     await c.query("UPDATE tpa.onboarding_batches SET choices=choices||$2::jsonb WHERE id=$1",[preview.id,JSON.stringify({correctionParent:{batchId:parent.id,sourceHash:originalHash}})]);
    }
    await c.query('UPDATE tpa.onboarding_batches SET source_hash=$2,filename=$3 WHERE id=$1',[preview.id,createHash('sha256').update(content).digest('hex'),file.name]);
    const diagnostic=await diagnoseMembers(c,cells,cells.sourceRows,cells.cellErrors);
    const rows=preview.rows.map(row=>({...row,diagnosticIssues:diagnostic.rows.find(r=>r.sourceRow===row.sourceRow)?.issues??[]}));
    await c.query('UPDATE tpa.onboarding_batches SET rows=$2 WHERE id=$1',[preview.id,JSON.stringify(rows)]);
    return {...preview,rows,diagnostic};
   });
  }
  const input=await jsonBody(request);
  accepted=true;
  if(input.action==='retry') return transaction(c=>retryMemberJob(c,actor.id,input.id));
  if(input.action!=='enqueue') throw new OperationError('Choose enqueue or retry.',400,'invalid_action');
  return transaction(c=>enqueueMemberJob(c,actor.id,input));});
 if(response.ok && accepted) return new Response(response.body,{status:202,headers:response.headers});return response;
}
