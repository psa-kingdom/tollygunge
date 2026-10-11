/** Artifact-tool builder. Run using the bundled workspace dependency runtime. */
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const modules=process.env.TPA_ARTIFACT_RUNTIME_MODULES;
if(!modules) throw Error('Set TPA_ARTIFACT_RUNTIME_MODULES to the workspace dependency loader node_modules path.');
const require=createRequire(path.join(modules,'../package.json'));
const {Workbook,SpreadsheetFile}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
const folder=process.argv[2]??'.local/member-resolution';
const data=JSON.parse(await fs.readFile(folder+'/diagnosis.json','utf8'));
const workbook=Workbook.create(),headers=['Prefix','First Name','Last Name','Membership No.','Email','Mobile','Designation','Organisation','Address','Country','State','City','Pin','District','Postal Locality'];
const literal=v=>typeof v==='string' && /^[=]/.test(v)?"'"+v:v;
function sheet(name,matrix){const s=workbook.worksheets.add(name);s.showGridLines=false;
 const all=s.getRangeByIndexes(0,0,matrix.length,matrix[0].length);all.setNumberFormat('@');all.values=matrix.map(row=>row.map(literal));
 all.format.columnWidth=22;all.format.rowHeight=30;all.format.verticalAlignment='center';
 const heading=s.getRangeByIndexes(0,0,1,matrix[0].length);heading.format.fill='#172B4D';heading.format.font={bold:true,color:'#FFFFFF'};heading.format.rowHeight=38;
 s.freezePanes.freezeRows(1);return s;}
// First sheet intentionally has the importable extended contract. Originals are separate.
const corrections=sheet('Corrections',[[...headers,'Original Source Row','Original Source Hash'],...data.rows.map(r=>[...headers.map(h=>r.normalized[h]??r.source[h]??''),String(r.sourceRow),data.sourceHash])]);
const summary=sheet('Summary',[['Measure','Value','Meaning'],['SOURCE',data.rows.length,'All physical source rows reconciled'],['VALID',data.diagnostic.valid,'Eligible under strict current checks'],['CONFLICT',data.diagnostic.conflict,'Staff correction or identity resolution required'],['INVALID',data.diagnostic.invalid,'Invalid or dependent validation blocked'],['IMPORTED',0,'This diagnostic makes no member writes'],['UPDATED',0,'Create-only workflow'],['INVITATIONS SENT',0,'Import does not invite'],['SOURCE SHA256',data.sourceHash,'Original file remains unchanged'],['INSTRUCTIONS','Edit Corrections only','Originals are retained below; review a new preview before import'],['POLICY','Missing districts held','Do not invent address or identity facts']]);
summary.getRange('A:A').format.columnWidth=24;summary.getRange('B:B').format.columnWidth=72;summary.getRange('C:C').format.columnWidth=64;
sheet('Issues',[['Source row','Classification','Issue code','Field','Reason','Related source rows','Action'],...data.rows.flatMap(r=>r.issues.map(i=>[r.sourceRow,r.status,i.code,i.field,i.reason,(i.relatedRows??[]).join(', '),r.action]))]);
sheet('Originals',[[...headers,'Original Source Row','Original Source Hash'],...data.rows.map(r=>[...headers.map(h=>r.source[h]??''),String(r.sourceRow),data.sourceHash])]);
workbook.recalculate();
const preview=await workbook.render({sheetName:'Summary',autoCrop:'all',scale:1,format:'png'});
await fs.writeFile(folder+'/correction-summary.png',new Uint8Array(await preview.arrayBuffer()));
if(corrections.getRange('P2:Q2').values[0][1]!==data.sourceHash)throw Error('Correction lineage verification failed.');
const output=await SpreadsheetFile.exportXlsx(workbook);await output.save(folder+'/member-corrections.xlsx');
if(!process.env.TPA_WORKSPACE_PYTHON)throw Error('Set TPA_WORKSPACE_PYTHON to the bundled Python executable for ExcelJS namespace compatibility.');
execFileSync(process.env.TPA_WORKSPACE_PYTHON,['scripts/normalize-correction-xlsx.py',folder+'/member-corrections.xlsx'],{stdio:'inherit'});
console.log(JSON.stringify({rows:data.rows.length,output:folder+'/member-corrections.xlsx',sourceUnchanged:true}));
