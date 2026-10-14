import { cp,mkdir,readdir,readFile,writeFile,rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const base='.local/main-publish/deploy-final';
const build=(await readFile('.next/BUILD_ID','utf8')).trim();
const target='.local/live-product/release-'+build;
await mkdir(target,{recursive:true});await cp(base,target,{recursive:true});
const directories=['src','migrations','scripts','tests','data'];
for(const path of directories)await cp(path,target+'/'+path,{recursive:true});
for(const path of ['LIVE_PRODUCT_VERIFICATION.md','LIVE_PRODUCT_RELEASE_RUNBOOK.md','WEBSITE_ADMIN_CONTROL.md'])await cp('docs/'+path,target+'/docs/'+path);
// Retain the deployed CI fixture setup; this older checkout omits its fixes.
await cp(base+'/scripts/verify-onboarding-ci.mjs',target+'/scripts/verify-onboarding-ci.mjs');
for(const path of ['scripts/confirm-operational-mailbox.mts','scripts/reconcile-held-members.mts','scripts/test-operational-delivery.mts','scripts/verify-approved-account-hosted.mts']) {
 try {await cp(base+'/'+path,target+'/'+path)}catch(error){if(error.code!=='ENOENT')throw error;await rm(target+'/'+path,{force:true});}
}
for(const path of ['Dockerfile','.dockerignore','package.json','package-lock.json','next.config.mjs','tsconfig.json','eslint.config.mjs','playwright.config.ts']) {
 try{await cp(path,target+'/'+path)}catch(error){if(error.code!=='ENOENT')throw error;}
}
async function files(root,prefix='') {const rows=[];for(const entry of await readdir(root+'/'+prefix,{withFileTypes:true})){if(['node_modules','.next','.local'].includes(entry.name))continue;const name=prefix+entry.name;if(entry.isDirectory())rows.push(...await files(root,name+'/'));else rows.push(name);}return rows;}
const entries=[];const changes=[];
for(const path of (await files(target)).sort()) {
 const bytes=await readFile(target+'/'+path);const sha256=createHash('sha256').update(bytes).digest('hex');entries.push({path,sha256,bytes:bytes.length});
 let previous;try{previous=await readFile(base+'/'+path)}catch{}
 if(!previous||bytes.toString().replaceAll('\r\n','\n')!==previous.toString().replaceAll('\r\n','\n')) {
  const group=/website|WEBSITE|homepage|src\/app\/page.tsx|src\/app\/\[page\]\/page.tsx|media-workspace|editorial-approval|attention|content|people|person-editor|public-governance|public-media|site-shell|layout.tsx|domain\/media|staff\/media|staff-navigation|member-editor|member-register|downloads/.test(path)?'website control and shared dependencies':/event|flyer|attendance|registration|payment|email-worker|email-service|auth-controls|onboarding-auth|onboarding-delivery|password-controls|login|signup|operations|private-storage|report-query|globals|workspace-search|package.json|admin\/workspaces/.test(path)?'event and shared dependencies':/governance|resources\/\[slug\]|verify-live|verify-product|prepare-live|LIVE_PRODUCT/.test(path)?'live verification fixes and tooling':'review separately';
  changes.push({path,status:previous?'modified':'added',group,sha256});
 }
}
const manifest={prepared:new Date().toISOString(),baseCommit:'6532f3a9d8a58ae462a9902fce95fe01bce4d8a4',buildId:build,target,deploymentAuthorized:false,files:entries,changes};
await writeFile('.local/live-product/release-manifest.json',JSON.stringify(manifest,null,2));
let patch='';
for(const {path} of changes) {
 const diff=spawnSync('git',['diff','--no-index','--',await readFile(base+'/'+path).then(()=>base+'/'+path).catch(()=> 'NUL'),target+'/'+path],{encoding:'utf8',maxBuffer:16*1024*1024});
 if(![0,1].includes(diff.status))throw Error('Release diff generation failed: '+path);
 patch+=diff.stdout;
}
await writeFile('.local/live-product/release.patch',patch);
console.log(JSON.stringify({target,buildId:build,files:entries.length,changed:changes.length,separateReview:changes.filter(r=>r.group==='review separately').map(r=>r.path)}));
