import { authorized, operation, jsonBody, transaction, audit, OperationError } from '@/lib/operation-api';
import { getDatabase } from '@/lib/database';
import { record, uuid, version } from '@/domain/operations';
import { variantInput } from '@/domain/event-engagement';
export const runtime='nodejs';
export async function GET(request:Request) {return operation(async()=>{
 await authorized(request,'events:manage');const eventId=uuid(new URL(request.url).searchParams.get('eventId'));
 return (await getDatabase().query('SELECT * FROM tpa.flyer_variants WHERE event_id=$1 ORDER BY updated_at DESC',[eventId])).rows;
});}
export async function POST(request:Request) {return operation(async()=>{
 const actor=await authorized(request,'events:manage',true),body=record(await jsonBody(request)),input=variantInput(body),eventId=uuid(body.eventId);
 return transaction(async c=>{
  const event=(await c.query('SELECT * FROM tpa.events WHERE id=$1 FOR SHARE',[eventId])).rows[0];
  if(!event || !['draft','published'].includes(event.status) || event.completed_at || event.archived_at) throw new OperationError('Choose an editable event.',409);
  if(input.status==='published'&&(event.status!=='published'||!event.speakers.length))throw new OperationError('Publish the event with at least one speaker before publishing its flyer.',409);
  if(event.version!==version(body.eventVersion)) throw new OperationError('Event changed. Regenerate the preview.',409);
  const values=[eventId,input.name,input.headline,input.presentation,input.status,actor.id];
  const row=body.id?(await c.query('UPDATE tpa.flyer_variants SET name=$2,headline=$3,presentation=$4,status=$5,updated_by=$6,version=version+1,updated_at=now() WHERE event_id=$1 AND id=$7 AND version=$8 RETURNING *',[...values,uuid(body.id),version(body.version)])).rows[0]
   :(await c.query('INSERT INTO tpa.flyer_variants(event_id,name,headline,presentation,status,updated_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',values)).rows[0];
  if(!row) throw new OperationError('Variant changed. Reload first.',409);
  await audit(c,actor.id,'flyer.variant_saved',row.id);return row;
 });
});}
