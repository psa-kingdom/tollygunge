/** Read-only source/database diagnosis; restricted artifacts, aggregate-only stdout. */
import {Pool} from 'pg';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {databaseOptions} from '../src/lib/database-options';
import {importCells} from '../src/domain/onboarding-import';
import {diagnoseMembers} from '../src/lib/member-import-diagnostic';
const sourcePath=process.argv[2]??'../client/Database-200 CA.xlsx',output=process.argv[3]??'.local/member-resolution';
if(!output.startsWith('.local/')) throw Error('Use a restricted ignored .local output directory.');
const bytes=await readFile(sourcePath),sourceHash=createHash('sha256').update(bytes).digest('hex');
const historical=JSON.parse(await readFile('.local/real-data/production-member-results.json','utf8'));
assert.equal(sourceHash,historical.sourceHash,'Source differs from the persisted outcome report');
const cells=await importCells(bytes,sourcePath,{rowErrors:true});
const pool=new Pool(databaseOptions()),c=await pool.connect();
try {await c.query('BEGIN READ ONLY');const current=(await c.query(`SELECT current_database() AS database,(SELECT count(*) FROM tpa.memberships) AS memberships,(SELECT count(*) FROM tpa.people) AS people,(SELECT count(*) FROM public."user") AS accounts,(SELECT count(*) FROM tpa.onboarding_invitations) AS invitations,(SELECT count(*) FROM tpa.onboarding_mail) AS mail`)).rows[0];
 const diagnostic=await diagnoseMembers(c,cells,cells.sourceRows,cells.cellErrors);
 assert.equal(diagnostic.source,historical.results.length);assert.deepEqual(diagnostic.rows.map(r=>r.sourceRow),historical.results.map((r:{sourceRow:number})=>r.sourceRow));
 const primary:Record<string,number>={};for(const r of historical.results) primary[r.reason]=(primary[r.reason]??0)+1;
 const report={createdAt:new Date().toISOString(),sourcePath,sourceHash,historicalBatchId:historical.batchId,current,diagnostic,historical:{totals:historical.totals,primaryReasons:primary},rows:diagnostic.rows.map(r=>({...r,historicalOutcome:historical.results.find((old:{sourceRow:number})=>old.sourceRow===r.sourceRow)}))};
 await c.query('COMMIT');await mkdir(output,{recursive:true});await writeFile(output+'/diagnosis.json',JSON.stringify(report,null,2),{mode:0o600});
 console.log(JSON.stringify({source:diagnostic.source,valid:diagnostic.valid,conflict:diagnostic.conflict,invalid:diagnostic.invalid,issueRows:diagnostic.issues,database:current,imported:0,updated:0,invitationsSent:0,inspectionOnly:true},null,2));
}finally{await c.query('ROLLBACK').catch(()=>{});c.release();await pool.end();}
