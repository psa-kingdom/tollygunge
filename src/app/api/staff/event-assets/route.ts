import { randomUUID } from 'node:crypto';
import { authorized, operation, jsonBody, audit, OperationError } from '@/lib/operation-api';
import { getDatabase } from '@/lib/database';
import { record, uuid, version } from '@/domain/operations';
import { assetInput, eventResourceUrl } from '@/domain/event-engagement';
import { hasPermission } from '@/domain/access';
import { boundedBody } from '@/domain/request-body';
import { MAX_DOCUMENT_BYTES, validateDocument, matchesFileSignature } from '@/domain/documents';
import { eventAssetStorage, privateStorageConfigured } from '@/lib/private-storage';
import { uploadWithCleanup, UploadFailure } from '@/domain/upload-workflow';
export const runtime='nodejs';
export async function GET(request:Request) {return operation(async()=>{
 const actor=await authorized(request,'events:manage');const eventId=uuid(new URL(request.url).searchParams.get('eventId'));
 return {assets:(await getDatabase().query("SELECT * FROM tpa.event_assets WHERE event_id=$1 AND ($2 OR eligibility<>'finance') ORDER BY uploaded_at DESC",[eventId,hasPermission(actor.roles,'payments:manage')])).rows,
 members:(await getDatabase().query(`SELECT DISTINCT u.id,u.name FROM public."user" u JOIN tpa.people p ON p.user_id=u.id JOIN tpa.memberships m ON m.person_id=p.id ORDER BY u.name,u.id LIMIT 10000`)).rows};
});}
export async function POST(request:Request) {return operation(async()=>{
 const actor=await authorized(request,'events:manage',true);
 let body:Record<string,unknown>,file:File|null=null;
 if(request.headers.get('content-type')?.startsWith('multipart/form-data')) {
  const bytes=await boundedBody(request,MAX_DOCUMENT_BYTES+65536);
  const form=await new Response(bytes as BodyInit,{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();
  body=record(JSON.parse(String(form.get('details'))));const upload=form.get('file');
  if(!(upload instanceof File)) throw new OperationError('Choose a PDF, JPEG or PNG.');file=upload;
 }else body=record(await jsonBody(request));
 const input=assetInput(body),eventId=uuid(body.eventId),id=body.id?uuid(body.id):randomUUID();
 if(input.eligibility==='finance'&&!hasPermission(actor.roles,'payments:manage')) throw new OperationError('Financial resources require finance permission.',403);
 const url=body.url?eventResourceUrl(body.url):null;
 let bytes:Uint8Array|undefined;
 if(file) {validateDocument('supporting',file.type,file.size);bytes=new Uint8Array(await file.arrayBuffer());if(!matchesFileSignature(bytes,file.type)) throw new OperationError('File signature does not match its type.');}
 if(!body.id&&!file&&!url) throw new OperationError('Choose a file or HTTPS recording link.');
 if(file&&url) throw new OperationError('Choose either a file or a link.');
 if(body.id&&file) throw new OperationError('Upload a new resource to replace a file.');
 if(file&&!privateStorageConfigured()) throw new OperationError('Private storage is unavailable.',503);
 const c=await getDatabase().connect();
 try {await c.query('BEGIN');
  const event=(await c.query('SELECT * FROM tpa.events WHERE id=$1 FOR UPDATE',[eventId])).rows[0];if(!event) throw new OperationError('Event not found.',404);
  if(event.completed_at||event.archived_at) throw new OperationError('Reopen the event before changing resources.',409);
  if(body.id) {const prior=(await c.query('SELECT eligibility FROM tpa.event_assets WHERE id=$1 AND event_id=$2 FOR UPDATE',[id,eventId])).rows[0];if(prior?.eligibility==='finance'&&!hasPermission(actor.roles,'payments:manage')) throw new OperationError('Financial resources require finance permission.',403);}
  if(input.selectedMembers.length && (await c.query(`SELECT DISTINCT p.user_id FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id WHERE p.user_id=ANY($1::text[])`,[input.selectedMembers])).rowCount!==input.selectedMembers.length) throw new OperationError('Select existing member accounts.');
  const values=[eventId,input.title,input.description,input.type,input.status,input.eligibility,input.selectedMembers,actor.id,id];
  const persist=async()=>{
   const row=!body.id?(await c.query(`INSERT INTO tpa.event_assets(event_id,title,description,type,status,eligibility,selected_members,updated_by,id,content_type,byte_size,url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[...values,file?.type??null,file?.size??null,url])).rows[0]
    :(await c.query(`UPDATE tpa.event_assets SET title=$2,description=$3,type=$4,status=$5,eligibility=$6,selected_members=$7,updated_by=$8,version=version+1,updated_at=now() WHERE event_id=$1 AND id=$9 AND version=$10 RETURNING *`,[...values,version(body.version)])).rows[0];
   if(!row) throw new OperationError('Resource changed. Reload first.',409);
   await audit(c,actor.id,'event.asset_saved',id);return row;
  };
  if(file) {
   let saved;
   await uploadWithCleanup({store:()=>eventAssetStorage(id,'store',bytes!,file!.type),persist:async()=>{saved=await persist();await c.query('COMMIT');},remove:()=>eventAssetStorage(id,'remove')});
   return saved;
  }
  const row=await persist();await c.query('COMMIT');return row;
 }catch(error){await c.query('ROLLBACK');
  if(error instanceof UploadFailure) {
   if(error.cleanupFailed) await getDatabase().query("INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,'event.asset_cleanup_required',$2)",[actor.id,id]);
   throw new OperationError('Resource upload did not complete. Please try again later.',503);
  }
  throw error;
 }finally{c.release();}
});}
