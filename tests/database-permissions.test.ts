import test from 'node:test';import assert from 'node:assert/strict';
import{localIdentity,runtimeEnvironment}from'../scripts/security/rehearse-roles.mjs';
import{tablePermissions}from'../scripts/security/database-permissions.mjs';
test('role rehearsal rejects hosted, unexpected, wrong-port and non-bootstrap connections',()=>{
 const valid={DATABASE_URL:'postgresql://tpa_qa@127.0.0.1:55439/tpa_security_test_guard',TPA_DATABASE_NAME:'tpa_security_test_guard',DATABASE_SSL:'false'};
 assert.doesNotThrow(()=>localIdentity(valid));
 for(const url of ['postgresql://tpa_qa@example.com:55439/tpa_security_test_guard','postgresql://tpa_qa@127.0.0.1:5432/tpa_security_test_guard','postgresql://tpa_qa@127.0.0.1:55439/railway','postgresql://other@127.0.0.1:55439/tpa_security_test_guard'])assert.throws(()=>localIdentity({...valid,DATABASE_URL:url}));
 assert.throws(()=>localIdentity({...valid,TPA_DATABASE_NAME:'railway'}));
 assert.throws(()=>localIdentity({...valid,DATABASE_URL:valid.DATABASE_URL+'?options=-c%20role%3Dpostgres'}));
 const web=runtimeEnvironment({...valid,TPA_EMAIL_DATABASE_URL:'not-a-child-value',TPA_MIGRATION_DATABASE_URL:'never-runtime'},'web');assert.equal(web.TPA_EMAIL_DATABASE_URL,undefined);assert.equal(web.TPA_MIGRATION_DATABASE_URL,undefined);assert.notEqual(new URL(web.DATABASE_URL).username,'tpa_qa');
});

test('newsletter worker can recheck consent without changing subscribers or reading request history',()=>{
 for(const table of ['tpa.public_subscribers','tpa.public_subscription_tokens']){
  assert.deepEqual(tablePermissions.email[table],['SELECT']);
  assert.equal(tablePermissions.import[table],undefined);
  assert.ok(tablePermissions.web[table].includes('INSERT'));
  assert.ok(tablePermissions.web[table].includes('UPDATE'));
 }
 assert.equal(tablePermissions.email['tpa.public_subscription_requests'],undefined);
 assert.equal(tablePermissions.import['tpa.public_subscription_requests'],undefined);
 assert.deepEqual(tablePermissions.web['tpa.public_subscription_requests'],['INSERT','SELECT']);
});
