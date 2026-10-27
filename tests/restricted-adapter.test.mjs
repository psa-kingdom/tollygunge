import test,{after}from'node:test';import assert from'node:assert/strict';import childProcess from'node:child_process';import{syncBuiltinESMExports}from'node:module';
const original=childProcess.spawn;
childProcess.spawn=(_command,args,options)=>({args,options});syncBuiltinESMExports();
await import('./helpers/restricted-runtime.mjs');
after(()=>{childProcess.spawn=original;syncBuiltinESMExports();});
test('nested invitation and import HTTP harnesses retain explicit role enforcement',()=>{
 for(const name of ['member-import-jobs','invitation-release']){const args=['--import','tsx',`scripts/test-${name}-http.mts`],r=childProcess.spawn(process.execPath,args,{env:{}});assert.equal(r.args[0],'--import');assert.ok(r.args[1].endsWith('/tests/helpers/restricted-runtime.mjs'));assert.deepEqual(r.args.slice(2),args);}
});
test('fixture migrations remain administrative and do not receive the runtime adapter',()=>{
 const args=['scripts/migrate.mjs'],r=childProcess.spawn(process.execPath,args,{env:{}});assert.deepEqual(r.args,args);
});
