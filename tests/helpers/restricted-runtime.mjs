/** Explicit opt-in fixture adapter: fixtures/migrations stay admin; actual servers/workers do not. */
import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runtimeEnvironment} from '../../scripts/security/rehearse-roles.mjs';
const original=childProcess.spawn;
const setup=fileURLToPath(new URL('../../scripts/security/rehearse-roles.mjs',import.meta.url));
childProcess.spawn=function(command,args,options){
 // Some public harnesses delegate to a second HTTP harness. Preserve the
 // explicit opt-in there; never rely on inherited NODE_OPTIONS or silently
 // exercise the nested web/import process with the fixture administrator.
 const nested=args?.some(a=>typeof a==='string'&&/scripts[\\/]test-(?:member-import-jobs|invitation-release)-http\.mts$/.test(a));
 if(nested&&!args.some(a=>typeof a==='string'&&a.includes('restricted-runtime.mjs')))args=['--import',import.meta.url,...args];
 const worker=args?.find(a=>typeof a==='string'&&/(?:^|[\\/])(?:email-worker|member-import-worker)\.mjs$/.test(a));
 const next=args?.some(a=>typeof a==='string'&&/next[\\/]dist[\\/]bin[\\/]next$/.test(a))&&args.includes('start');
 if(worker||next){
  const env=options?.env||process.env,kind=worker?.includes('member-import')?'import':worker?'email':'web';
  // Only deliberately forced unreachable-db fixtures remain unreachable.
  if(new URL(env.DATABASE_URL||'').port==='1')return original.call(this,command,args,options);
  const setupEnv={...env,TPA_ROLE_EVIDENCE_DIR:process.env.TPA_ROLE_EVIDENCE_DIR};
  childProcess.execFileSync(process.execPath,[setup],{env:setupEnv,stdio:['ignore','pipe','pipe'],timeout:30000});
  options={...options,env:runtimeEnvironment(env,kind)};
 }
 return original.call(this,command,args,options);
};
syncBuiltinESMExports();
