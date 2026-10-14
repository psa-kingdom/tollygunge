import 'server-only';
import {randomUUID,randomBytes} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import type {Pool,PoolClient} from 'pg';
import {validateInvitationTemplate,renderInvitation,invitationDefaults} from '@/domain/invitation-template';
import {OperationError} from './operation-error';
import {audit} from './operation-audit';
import {hashToken,sealMail} from './onboarding-mail';
type DB=Pick<Pool|PoolClient,'query'>;
export async function invitationTemplateState(db:DB){
 const head=(await db.query('SELECT * FROM tpa.invitation_template_state WHERE singleton')).rows[0];
 const templates=(await db.query('SELECT id,subject,body,created_at,approved_at,approved_by FROM tpa.invitation_templates ORDER BY created_at DESC LIMIT 30')).rows;
 return {...head,templates,defaults:invitationDefaults};
}
export async function invitationTemplateAction(c:PoolClient,actor:string,input:Record<string,unknown>){
 const head=(await c.query('SELECT * FROM tpa.invitation_template_state WHERE singleton FOR UPDATE')).rows[0];
 if(input.revision!==head.revision)throw new OperationError('Template changed. Reload before continuing.',409,'stale_template');
 if(input.action==='save'){
  let content;try{content=validateInvitationTemplate(input);}catch(e){throw new OperationError((e as Error).message,400,'template_validation');}
  const id=randomUUID();await c.query('INSERT INTO tpa.invitation_templates(id,subject,body,created_by) VALUES($1,$2,$3,$4)',[id,content.subject,content.body,actor]);
  await c.query('UPDATE tpa.invitation_template_state SET latest_id=$1,approved_id=NULL,revision=revision+1 WHERE singleton',[id]);
  await audit(c,actor,'invitation.template_saved',id);
 }else if(input.action==='approve'){
  if(!head.latest_id || input.id!==head.latest_id)throw new OperationError('Review the latest saved draft before approving.',409,'stale_template');
  await c.query('UPDATE tpa.invitation_templates SET approved_by=$2,approved_at=coalesce(approved_at,now()) WHERE id=$1 AND approved_at IS NULL',[head.latest_id,actor]);
  await c.query('UPDATE tpa.invitation_template_state SET approved_id=latest_id,revision=revision+1 WHERE singleton');
  await audit(c,actor,'invitation.template_approved',head.latest_id);
 }else throw new OperationError('Choose a template action.');
 return invitationTemplateState(c);
}
type Recipient={person_id:string;user_id:string;name:string;email:string;person_version:number;membership_version:number;hold_version:number|null;account_updated:string;held:boolean;reason:string|null};
async function recipients(db:DB,ids:string[]):Promise<Recipient[]>{
 return (await db.query(`SELECT p.id AS person_id,p.user_id,p.accepted->>'name' AS name,p.contact_email AS email,p.version AS person_version,m.version AS membership_version,h.version AS hold_version,u."updatedAt"::text AS account_updated,(h.user_id IS NOT NULL AND h.released_at IS NULL) AS held,
 CASE WHEN p.user_id IS NULL THEN 'No linked account; create an account separately.'
 WHEN lower(btrim(u.email)) IS DISTINCT FROM lower(btrim(p.contact_email)) OR coalesce(p.contact_email,'')='' THEN 'Account and member email do not agree.'
 WHEN EXISTS(SELECT 1 FROM public."account" a WHERE a."userId"=p.user_id AND a."providerId"='credential') OR EXISTS(SELECT 1 FROM tpa.onboarding_invitations i WHERE i.user_id=p.user_id AND i.redeemed_at IS NOT NULL) THEN 'Account is already activated; use password recovery.'
 WHEN EXISTS(SELECT 1 FROM tpa.onboarding_mail mail WHERE mail.user_id=p.user_id AND mail.kind='invitation' AND (mail.status IN ('queued','leased') OR mail.created_at>now()-interval '10 minutes' OR mail.reason='uncertain_send_expired')) THEN 'Invitation is queued, recently sent or requires delivery reconciliation.'
 WHEN (h.user_id IS NULL OR h.released_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM tpa.onboarding_invitations i WHERE i.user_id=p.user_id) THEN 'No held or previously issued invitation.'
 ELSE NULL END AS reason
 FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id LEFT JOIN public."user" u ON u.id=p.user_id LEFT JOIN tpa.account_invitation_holds h ON h.user_id=p.user_id WHERE p.id=ANY($1::uuid[]) ORDER BY p.id`,[ids])).rows;
}
export async function createInvitationReview(c:PoolClient,actor:string,input:Record<string,unknown>){
 if(!Array.isArray(input.personIds) || input.personIds.length<1 || input.personIds.length>1000 || input.personIds.some(id=>typeof id!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)))throw new OperationError('Select 1–1,000 member records.');
 const ids=[...new Set(input.personIds as string[])];
 const state=(await c.query('SELECT * FROM tpa.invitation_template_state WHERE singleton FOR SHARE')).rows[0];
 if(!state.approved_id)throw new OperationError('Approve the invitation template before reviewing recipients.',409,'template_unapproved');
 const template=(await c.query('SELECT * FROM tpa.invitation_templates WHERE id=$1',[state.approved_id])).rows[0];
 const rows=await recipients(c,ids),eligible=rows.filter(row=>!row.reason),exclusions=[...rows.filter(row=>row.reason),...ids.filter(id=>!rows.some(row=>row.person_id===id)).map(person_id=>({person_id,reason:'Member record not found.'}))];
 if(!eligible.length)throw new OperationError('No selected recipients are eligible. Review their account and delivery status.',409,'no_eligible_recipients');
 const id=randomUUID(),key=randomUUID();
 await c.query('INSERT INTO tpa.invitation_release_reviews(id,actor_id,template_id,template_revision,recipients,exclusions,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,actor,state.approved_id,state.revision,JSON.stringify(eligible),JSON.stringify(exclusions),key]);
 await audit(c,actor,'invitation.review_created',id);return getInvitationReview(c,actor,id,template);
}
export async function getInvitationReview(db:DB,actor:string,id:string,providedTemplate?:Record<string,string>){
 const review=(await db.query('SELECT * FROM tpa.invitation_release_reviews WHERE id::text=$1 AND actor_id=$2',[id,actor])).rows[0];
 if(!review)throw new OperationError('Invitation review not found.',404);
 const template=providedTemplate??(await db.query('SELECT subject,body FROM tpa.invitation_templates WHERE id=$1',[review.template_id])).rows[0];
 const rendered=renderInvitation({subject:template.subject,body:template.body},review.recipients[0].name,'https://tpassociation.org/invitation#token=PREVIEW_ONLY');
 const delivery=review.confirmed_at?(await db.query("SELECT user_id,status,reason,created_at FROM tpa.onboarding_mail WHERE dedupe LIKE $1 ORDER BY created_at",['release-'+review.id+'-%'])).rows:[];
 return {...review,rendered,delivery};
}
export async function confirmInvitationReview(c:PoolClient,actor:string,input:Record<string,unknown>){
 const review=(await c.query('SELECT * FROM tpa.invitation_release_reviews WHERE id::text=$1 AND actor_id=$2 FOR UPDATE',[String(input.id??''),actor])).rows[0];
 if(!review)throw new OperationError('Invitation review not found.',404);
 if(input.idempotencyKey!==review.idempotency_key)throw new OperationError('Confirmation does not match this review.',409,'review_mismatch');
 if(review.confirmed_at)return getInvitationReview(c,actor,review.id);
 if(process.env.ONBOARDING_ENABLED!=='true')throw new OperationError('Invitations are disabled.',503);
 if(new Date(review.expires_at).getTime()<=Date.now())throw new OperationError('Review expired. Review recipients again.',409,'stale_review');
 const state=(await c.query('SELECT * FROM tpa.invitation_template_state WHERE singleton FOR SHARE')).rows[0];
 if(state.approved_id!==review.template_id || state.revision!==review.template_revision)throw new OperationError('Template changed. Review recipients again.',409,'stale_review');
 const ids=review.recipients.map((r:Recipient)=>r.person_id),userIds=review.recipients.map((r:Recipient)=>r.user_id);
 // Stable lock ordering serializes competing previews and account activation.
 await c.query('SELECT id FROM tpa.people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
 await c.query('SELECT id FROM tpa.memberships WHERE person_id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
 await c.query('SELECT id FROM public."user" WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[userIds]);
 await c.query('SELECT user_id FROM tpa.account_invitation_holds WHERE user_id=ANY($1::text[]) ORDER BY user_id FOR UPDATE',[userIds]);
 const current=await recipients(c,ids);
 if(!isDeepStrictEqual(current,review.recipients))throw new OperationError('Recipients changed. Create a fresh review.',409,'stale_review');
 const template=(await c.query('SELECT subject,body FROM tpa.invitation_templates WHERE id=$1',[review.template_id])).rows[0];
 const base=new URL(process.env.BETTER_AUTH_URL!);if(base.protocol!=='https:' && base.hostname!=='127.0.0.1' && base.hostname!=='localhost')throw new OperationError('Configure a secure invitation URL.',503);
 const tokens=current.map(r=>({...r,token:randomBytes(32).toString('base64url')}));
 await c.query('DELETE FROM tpa.onboarding_invitations WHERE user_id=ANY($1::text[]) AND redeemed_at IS NULL',[userIds]);
 await c.query("INSERT INTO tpa.onboarding_invitations(token_hash,user_id,expires_at) SELECT x.hash,x.user_id,now()+interval '48 hours' FROM jsonb_to_recordset($1::jsonb) AS x(hash text,user_id text)",[JSON.stringify(tokens.map(r=>({hash:hashToken(r.token),user_id:r.user_id})))]);
 const mail=tokens.map(r=>({id:randomUUID(),dedupe:'release-'+review.id+'-'+r.user_id,user_id:r.user_id,recipient:r.email,payload:sealMail(renderInvitation(template,r.name,new URL('/invitation',base).href+'#token='+r.token))}));
 await c.query("INSERT INTO tpa.onboarding_mail(id,dedupe,user_id,recipient,kind,payload) SELECT x.id,x.dedupe,x.user_id,x.recipient,'invitation',x.payload FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,dedupe text,user_id text,recipient text,payload jsonb)",[JSON.stringify(mail)]);
 await c.query('UPDATE tpa.account_invitation_holds SET released_at=now(),version=version+1 WHERE user_id=ANY($1::text[]) AND released_at IS NULL',[userIds]);
 const results=current.map(r=>({personId:r.person_id,userId:r.user_id,email:r.email,status:'queued'}));
 await c.query('UPDATE tpa.invitation_release_reviews SET confirmed_at=now(),results=$2 WHERE id=$1',[review.id,JSON.stringify(results)]);
 await audit(c,actor,'invitation.review_released',review.id);return getInvitationReview(c,actor,review.id);
}
