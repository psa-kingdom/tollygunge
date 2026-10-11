import {authorized,operation,jsonBody,transaction,OperationError} from '@/lib/operation-api';
import {getDatabase} from '@/lib/database';
import {invitationTemplateState,invitationTemplateAction} from '@/lib/invitation-release';
import {validateInvitationTemplate,renderInvitation} from '@/domain/invitation-template';
export async function GET(request:Request){return operation(async()=>{await authorized(request,'staff:manage');return invitationTemplateState(getDatabase());});}
export async function POST(request:Request){return operation(async()=>{
 const actor=await authorized(request,'staff:manage',true),input=await jsonBody(request,16000);
 if(input.action==='preview'){try{return renderInvitation(validateInvitationTemplate(input),'Example Member','https://tpassociation.org/invitation#token=PREVIEW_ONLY');}catch(e){throw new OperationError((e as Error).message,400,'template_validation');}}
 return transaction(c=>invitationTemplateAction(c,actor.id,input));
});}
