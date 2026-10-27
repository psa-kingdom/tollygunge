import test from 'node:test';
import assert from 'node:assert/strict';
import {startRuntime} from '../scripts/start-runtime.mjs';
import {EventEmitter} from 'node:events';
function environments(env){const rows=[];const runtime=startRuntime({env,spawnProcess:(_node,[file],options)=>{const child=new EventEmitter();child.kill=()=>{};rows.push({file,env:options.env});return child;},schedule:()=>({unref(){}}),cancel(){},publish(){},report(){}});runtime.stop();return rows;}
test('supervisor scopes database identities and strips migration and sibling credentials',()=>{
 const rows=environments({DATABASE_URL:'web-synthetic',TPA_EMAIL_DATABASE_URL:'email-synthetic',TPA_IMPORT_DATABASE_URL:'import-synthetic',TPA_MIGRATION_DATABASE_URL:'migration-synthetic',RESEND_API_KEY:'send-synthetic'});
 assert.deepEqual(rows.map(r=>r.env.DATABASE_URL),['web-synthetic','email-synthetic','import-synthetic']);
 for(const row of rows)for(const key of ['TPA_EMAIL_DATABASE_URL','TPA_IMPORT_DATABASE_URL','TPA_MIGRATION_DATABASE_URL'])assert.equal(row.env[key],undefined);
 assert.equal(rows[2].env.RESEND_API_KEY,undefined);
});
test('database routing remains backward compatible when scoped inputs are absent',()=>{
 assert.deepEqual(environments({DATABASE_URL:'shared-synthetic'}).map(r=>r.env.DATABASE_URL),Array(3).fill('shared-synthetic'));
});
