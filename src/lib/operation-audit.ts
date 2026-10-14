import type {PoolClient} from 'pg';
export async function audit(client:PoolClient,actor:string,action:string,id:string) {
 await client.query('INSERT INTO tpa.audit_events(actor_user_id,action,entity_id) VALUES($1,$2,$3)',[actor,action,id]);
}
