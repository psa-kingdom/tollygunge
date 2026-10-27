/** Anonymous GET-only production observations. Never creates sessions or follows token links. */
import {mkdir,writeFile} from 'node:fs/promises';
const origin='https://tpassociation.org';
const cases=[['/','public',200],['/login','public',200],['/api/health','readiness',200],['/api/staff/members','anonymous-denial',401],['/api/member/profile','anonymous-denial',401],['/api/documents/00000000-0000-0000-0000-000000000000','anonymous-denial',401]];
const observations=[];
for(const [path,kind,expectedStatus]of cases){
 try{
  const response=await fetch(origin+path,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'TPA-launch-readiness-readonly'}});
  const row={path,kind,status:response.status,expectedStatus,result:response.status===expectedStatus?'PASS':'FAIL',headers:Object.fromEntries(['cache-control','referrer-policy','x-content-type-options','x-frame-options','strict-transport-security'].map(k=>[k,response.headers.get(k)]))};
  if(kind==='readiness'){const body=await response.json();row.health={status:body.status,backgroundProcesses:body.backgroundProcesses};if(body.status!=='ready')row.result='FAIL';}
  else await response.body?.cancel();
  observations.push(row);
 }catch{observations.push({path,kind,result:'BLOCKED',limitation:'Anonymous GET failed or timed out; no credentials used.'});}
}
const dir='.local/launch-readiness/production-readonly-'+new Date().toISOString().replaceAll(':','-');await mkdir(dir,{recursive:true});
const report={observed:new Date().toISOString(),environment:'production anonymous read-only',origin,sessionCreated:false,observations,limitation:'HTTP observations do not prove authenticated journeys or candidate deployment.'};
await writeFile(dir+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({evidence:dir+'/results.json',observations}));
if(observations.some(r=>r.result!=='PASS'))process.exitCode=1;
