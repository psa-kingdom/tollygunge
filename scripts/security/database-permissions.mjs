/** Reviewed, closed table allowlists. Never infer production grants at runtime. */
import {readFileSync} from 'node:fs';
export const webTables=JSON.parse(readFileSync(new URL('./web-permissions.json',import.meta.url),'utf8'));
const read=(names)=>Object.fromEntries(names.split(' ').map(n=>[n,['SELECT']]));
export const emailTables={
 ...read('public.user tpa.staff_roles tpa.operator_approved_identities tpa.newsletter_consents tpa.public_subscribers tpa.public_subscription_tokens tpa.member_profiles tpa.people tpa.memberships tpa.events tpa.event_registrations tpa.event_promotion_settings'),
 'tpa.email_jobs':['SELECT','INSERT','UPDATE'],
 'tpa.email_messages':['SELECT','INSERT'],
 'tpa.email_conversations':['SELECT','INSERT','UPDATE'],
 'tpa.email_suppressions':['SELECT','INSERT'],
 'tpa.email_worker_state':['SELECT','INSERT','UPDATE'],
 'tpa.email_dispatches':['SELECT','INSERT'],
 'tpa.email_unsubscribe_tokens':['INSERT'],
 'tpa.onboarding_mail':['SELECT','INSERT','UPDATE'],
 'tpa.onboarding_mail_events':['SELECT','INSERT'],
 'tpa.event_reminders':['SELECT','INSERT','UPDATE'],
 'tpa.event_promotions':['SELECT','INSERT'],
};
export const importTables={
 ...read('tpa.postal_versions tpa.postal_locations tpa.postal_city_aliases'),
 'public.user':['SELECT','INSERT'],
 'tpa.account_invitation_holds':['INSERT'],
 'tpa.people':['SELECT','INSERT','UPDATE'],
 'tpa.memberships':['SELECT','INSERT','UPDATE'],
 'tpa.person_revisions':['INSERT'],
 'tpa.member_profiles':['SELECT','UPDATE'],
 'tpa.audit_events':['INSERT'],
 'tpa.onboarding_batches':['SELECT','UPDATE'],
 'tpa.member_import_jobs':['SELECT','INSERT','UPDATE'],
 'tpa.member_import_job_rows':['SELECT','INSERT','UPDATE'],
 'tpa.member_import_worker_state':['SELECT','INSERT','UPDATE'],
};
/** @type {Record<'web'|'email'|'import', Record<string, string[]>>} */
export const tablePermissions={web:webTables,email:emailTables,import:importTables};
// PostgreSQL row-lock clauses require UPDATE on at least one column. These
// timestamp-only grants preserve existing locking without granting business writes.
export const columnPermissions={web:{},email:{'tpa.events':{UPDATE:['created_at']},'tpa.event_registrations':{UPDATE:['registered_at']}},import:{'public.user':{UPDATE:['updatedAt']}}};
export const sequencePermissions={web:['tpa.audit_events_id_seq','tpa.event_operation_history_id_seq','tpa.payment_detail_revisions_id_seq','tpa.website_revisions_id_seq'],email:[],import:['tpa.audit_events_id_seq']};
export function quoteIdentifier(name){if(!/^[A-Za-z_][A-Za-z_0-9]*$/.test(name))throw Error('Invalid identifier');return '"'+name+'"';}
export function quoteObject(name){return name.split('.').map(quoteIdentifier).join('.');}
