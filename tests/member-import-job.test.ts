import test from 'node:test';
import assert from 'node:assert/strict';
import {mapMembers,correctionMemberHeaders,extendedMemberHeaders,memberHeaders} from '../src/domain/member-import';
import {memberJobTotals,transientImportError} from '../src/domain/member-import-job';
import ExcelJS from 'exceljs';
import {importCells} from '../src/domain/onboarding-import';

test('correction workbook accepts only explicit reserved worksheets and preserves lineage',async()=>{
 const workbook=new ExcelJS.Workbook();
 const sheet=workbook.addWorksheet('Corrections');
 sheet.addRow(correctionMemberHeaders);
 sheet.addRow(['CA','First','Member','000123','user@example.invalid','','','','','','','','','','','107','a'.repeat(64)]);
 for(const name of ['Summary','Issues','Originals'])workbook.addWorksheet(name).addRow(['Retained context']);
 const bytes=new Uint8Array(await workbook.xlsx.writeBuffer());
 await assert.rejects(importCells(bytes,'correction.xlsx'),/one worksheet/);
 const parsed=await importCells(bytes,'correction.xlsx',{rowErrors:true,correctionWorkbook:true});
 assert.equal(mapMembers(parsed,parsed.sourceRows,parsed.cellErrors)[0].sourceRow,107);
 assert.equal(mapMembers(parsed)[0].membershipNumber,'000123');
 workbook.getWorksheet('Originals')!.name='Unexpected';
 await assert.rejects(importCells(new Uint8Array(await workbook.xlsx.writeBuffer()),'correction.xlsx',{correctionWorkbook:true}),/one worksheet/);
});
test('extended corrections retain source identity, districts, identifiers and reject malformed lineage',()=>{
 const row=['CA','First','Member','000123',' USER@EXAMPLE.INVALID ','9876543210','','','12 Road','India','West Bengal','Kolkata','700001','Kolkata','Kolkata GPO'];
 const mapped=mapMembers([correctionMemberHeaders,[...row,'107','a'.repeat(64)]],[1,2]);
 assert.equal(mapped[0].sourceRow,107);assert.equal(mapped[0].member?.addresses.correspondence?.district,'Kolkata');assert.equal(mapped[0].membershipNumber,'000123');assert.equal(mapped[0].member?.email,'user@example.invalid');
 assert.equal(mapMembers([extendedMemberHeaders,row])[0].member?.addresses.correspondence?.postalLocality,'Kolkata GPO');
 assert.ok(mapMembers([correctionMemberHeaders,[...row,'bad','hash']])[0].fieldErrors.file);
 assert.throws(()=>mapMembers([correctionMemberHeaders,[...row,'107','a'.repeat(64)],[...row,'107','a'.repeat(64)]]),/Check/);
 const unsafe=[...row];unsafe[1]="'=unsafe";assert.ok(mapMembers([extendedMemberHeaders,unsafe])[0].fieldErrors['First Name']);
 assert.equal(mapMembers([memberHeaders,row.slice(0,13)])[0].member?.addresses.correspondence?.district,'');
});
test('job totals and transient errors separate source problems from retryable transport failures',()=>{
 assert.equal(memberJobTotals([{status:'invalid'},{status:'retry'},{status:'created'}]).created,1);
 for(const code of ['40001','40P01','57014','08006','ECONNRESET'])assert.equal(transientImportError(code),true);
 for(const code of ['23505','22000','member_validation',undefined])assert.equal(transientImportError(code),false);
});
