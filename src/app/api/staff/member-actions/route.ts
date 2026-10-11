import {authorized,operation,jsonBody,transaction,audit,OperationError} from '@/lib/operation-api';
import {uuid,version} from '@/domain/operations';
export async function POST(request:Request){return operation(async()=>{
 const actor=await authorized(request,'staff:manage',true),input=await jsonBody(request,5000),id=uuid(input.personId);
 if(['invite','resend','release'].includes(input.action))throw new OperationError('Review recipients and the approved template before confirming invitations.',409,'invitation_review_required');
 if(input.action!=='membership')throw new OperationError('Choose a member operation.');
 return transaction(async c=>{
  const member=(await c.query('SELECT m.* FROM tpa.memberships m JOIN tpa.people p ON p.id=m.person_id WHERE p.id=$1 FOR UPDATE OF p,m',[id])).rows[0];
  if(!member)throw new OperationError('Member not found.',404);
  if(member.version!==version(input.version))throw new OperationError('Membership changed. Reload.',409);
  if(!['active','expired','suspended','resigned'].includes(input.status))throw new OperationError('Choose a membership status.');
  await c.query('UPDATE tpa.memberships SET status=$2,version=version+1,updated_at=now() WHERE id=$1',[member.id,input.status]);
  await audit(c,actor.id,'membership.'+input.status,member.id);return {saved:true};
 });
});}
