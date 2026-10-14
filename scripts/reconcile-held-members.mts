/** Read-only production or rehearsal reconciliation. No sessions, tokens or mail writes. */
import {Pool} from 'pg';import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';import {databaseOptions} from '../src/lib/database-options';import {approvedAccountSourceHash} from '../src/domain/approved-account-batch';
const pool=new Pool(databaseOptions()),c=await pool.connect();
try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const batch=(await c.query("SELECT id,source_hash,results,committed_at FROM tpa.onboarding_batches WHERE id='cc390059-7f6e-444b-a821-577948f03b49'")).rows[0];assert.ok(batch?.committed_at);assert.equal(batch.source_hash,approvedAccountSourceHash);assert.equal(batch.results.length,211);
 const created=batch.results.filter((r:{status:string})=>r.status==='created'),held=batch.results.filter((r:{status:string})=>r.status==='conflict');assert.equal(created.length,202);assert.equal(held.length,9);
 const ids=created.map((r:{accountId:string})=>r.accountId);const counts=(await c.query(`SELECT now() inspected_at,(SELECT count(*)::int FROM public."user") accounts,(SELECT count(*)::int FROM tpa.people) people,(SELECT count(*)::int FROM tpa.memberships) members,
 (SELECT count(*)::int FROM public."user" WHERE id=ANY($1::text[])) batch_accounts,
 (SELECT count(*)::int FROM tpa.people p JOIN tpa.memberships m ON m.person_id=p.id WHERE p.user_id=ANY($1::text[])) batch_members,
 (SELECT count(*)::int FROM tpa.account_invitation_holds WHERE user_id=ANY($1::text[]) AND released_at IS NULL) unreleased,
 (SELECT count(*)::int FROM tpa.onboarding_invitations WHERE user_id=ANY($1::text[])) batch_tokens,
 (SELECT count(*)::int FROM tpa.onboarding_mail WHERE user_id=ANY($1::text[])) batch_mail,
 (SELECT count(*)::int FROM public."account" WHERE "userId"=ANY($1::text[])) batch_credentials`,[ids])).rows[0];
 assert.equal(counts.batch_accounts,202);assert.equal(counts.batch_members,202);assert.equal(counts.unreleased,202);for(const key of ['batch_tokens','batch_mail','batch_credentials'])assert.equal(counts[key],0);
 await c.query('COMMIT');await mkdir('.local/controlled-invitations',{recursive:true});const report={...counts,sourceRows:211,created:202,heldSourceRows:9,inspectionOnly:true};await writeFile('.local/controlled-invitations/reconciliation.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
}finally{c.release();await pool.end();}
