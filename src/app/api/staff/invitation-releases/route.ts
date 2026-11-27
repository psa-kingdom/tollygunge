import {authorized,operation,jsonBody,transaction,OperationError} from '@/lib/operation-api';
import {getDatabase} from '@/lib/database';
import {createBatchInvitationReview,createInvitationReview,getInvitationReview,confirmInvitationReview} from '@/lib/invitation-release';
export async function GET(request:Request){return operation(async()=>{
 const actor=await authorized(request,'staff:manage'),id=new URL(request.url).searchParams.get('id');
 if(!id)throw new OperationError('Choose an invitation review.');return getInvitationReview(getDatabase(),actor.id,id);
});}
export async function POST(request:Request){return operation(async()=>{
 const actor=await authorized(request,'staff:manage',true),input=await jsonBody(request);
 return transaction(async c=>{await c.query("SET LOCAL statement_timeout='10s'");await c.query("SET LOCAL lock_timeout='3s'");
  if(input.action==='review-batch')return createBatchInvitationReview(c,actor.id,input.batchId);
  if(input.action==='review')return createInvitationReview(c,actor.id,input);
  if(input.action==='confirm'){
   if(input.batchId){
    const {rows:[batch]}=await c.query(
     "SELECT choices FROM tpa.onboarding_batches WHERE id::text=$1 AND actor_id=$2 FOR UPDATE",
     [String(input.batchId),actor.id],
    );
    if(batch?.choices.invitationReviewId!==input.id)
     throw new OperationError('The batch review changed. Refresh it before sending.',409,'stale_review');
   }
   return confirmInvitationReview(c,actor.id,input);
  }
  throw new OperationError('Choose an invitation review action.');
 });
});}
