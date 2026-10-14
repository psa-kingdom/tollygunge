import { authorized, operation, jsonBody, transaction, audit, OperationError } from '@/lib/operation-api';
import { getDatabase } from '@/lib/database';
import { record, uuid, version } from '@/domain/operations';
import { badgeInput } from '@/domain/event-engagement';
export const runtime='nodejs';
export async function GET(request:Request) {return operation(async()=>{await authorized(request,'events:manage');return (await getDatabase().query('SELECT * FROM tpa.event_badge_rules ORDER BY threshold,name')).rows;});}
export async function POST(request:Request) {return operation(async()=>{
 const actor=await authorized(request,'events:manage',true),body=record(await jsonBody(request)),input=badgeInput(body);
 return transaction(async c=>{
  const values=[input.name,input.description,input.threshold,input.icon,input.enabled,actor.id];
  const row=body.id?(await c.query('UPDATE tpa.event_badge_rules SET name=$1,description=$2,threshold=$3,icon=$4,enabled=$5,updated_by=$6,version=version+1,updated_at=now() WHERE id=$7 AND version=$8 RETURNING *',[...values,uuid(body.id),version(body.version)])).rows[0]
   :(await c.query('INSERT INTO tpa.event_badge_rules(name,description,threshold,icon,enabled,updated_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',values)).rows[0];
  if(!row) throw new OperationError('Badge rule changed. Reload first.',409);
  await audit(c,actor.id,'event.badge_rule_saved',row.id);return row;
 });
});}
