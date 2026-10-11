import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { memberInput,mobile,MemberValidationError,internationalPostalCode,memberDisplayName } from "../src/domain/member-foundation";
import { mapMembers,memberHeaders } from "../src/domain/member-import";
import { importCells,parseCsv } from "../src/domain/onboarding-import";
import { publicPerson,personBody,redactPerson } from "../src/domain/people";
import { passwordError } from "../src/domain/password-policy";
import { initialFields,validateFields,validateAnswers } from "../src/domain/verification";
const valid={prefix:" ca. ",firstName:" Alice  Jane ",lastName:" Example ",email:" ALICE@example.invalid ",membershipNumber:"0000123",mobile:"(98765) 43210",organization:"Example & Co"};
test("member rules normalize identity without losing names or leading zeros",()=>{
  const m=memberInput(valid);
  assert.equal(m.prefix,"CA");assert.equal(m.firstName,"Alice Jane");assert.equal(m.email,"alice@example.invalid");assert.equal(m.membershipNumber,"0000123");assert.equal(m.mobile,"+919876543210");
  for(const input of [{...valid,lastName:""},{...valid,email:"bad"},{...valid,mobile:"1234567890"},{...valid,prefix:"Wizard"},{...valid,category:"Student"},{...valid,email:{bad:true}}]) assert.throws(()=>memberInput(input),MemberValidationError);
  assert.equal(mobile(""),"");assert.equal(mobile("+44 7700 900123"),"+447700900123");assert.doesNotThrow(()=>memberInput({},false));
});
test("international postal formats follow selected countries and allow incomplete drafts",()=>{
  for(const [country,postal] of [["US","10001"],["US","10001-1234"],["CA","K1A 0B1"],["GB","SW1A 1AA"]]) assert.ok(internationalPostalCode(country,postal));
  for(const [country,postal] of [["US","SW1A 1AA"],["CA","123456"],["GB","10001"]]) assert.equal(internationalPostalCode(country,postal),false);
  assert.ok(internationalPostalCode("US","1",true));assert.equal(internationalPostalCode("US","1"),false);
});
test("register display names include prefixes and preserve ambiguous legacy names",()=>{
  const m=memberInput(valid);assert.equal(memberDisplayName(m),"CA Alice Jane Example");
  assert.equal(memberDisplayName({...m,lastName:"Changed"},{...m,name:"CA Alice Jane Example"}),"CA Alice Jane Changed");
  assert.equal(memberDisplayName(m,{name:"Legacy display"}),"Legacy display");
  assert.throws(()=>memberInput({...valid,firstName:"a".repeat(60),lastName:"b".repeat(60)}),MemberValidationError);
});
test("250 records, duplicate groups, optional blanks and physical row numbers are retained",()=>{
  const data=Array.from({length:250},(_,i)=>["CA","Member",`Person ${i}`,String(i).padStart(6,"0"),`person${i}@example.invalid`,"","","","","","","",""]);
  const rows=mapMembers([memberHeaders,...data]);assert.equal(rows.length,250);assert.ok(rows.every(r=>!Object.keys(r.fieldErrors).length));
  data[1][4]=data[0][4].toUpperCase();data[3][3]=data[2][3];
  const duplicates=mapMembers([memberHeaders,...data]);assert.equal(duplicates.filter(r=>r.status==="conflict").length,4);
  data[10][0]="Unknown prefix";data[11][4]="malformed email";data[12][5]="12345";data[13][1]="";
  const mixed=mapMembers([memberHeaders,...data]);assert.equal(mixed.length,250);assert.equal(mixed.filter(r=>Object.keys(r.fieldErrors).length).length,8);assert.equal(mixed.filter(r=>r.status==="conflict").length,4);
  const csv=parseCsv(memberHeaders.join(",")+"\n\n"+data[4].join(","));assert.deepEqual(csv.sourceRows,[1,3]);assert.equal(mapMembers(csv,csv.sourceRows)[0].sourceRow,3);
});
test("XLSX parser preserves number formats and surfaces cell errors per row",async()=>{
  const w=new ExcelJS.Workbook(),s=w.addWorksheet("Members");s.addRow(memberHeaders);s.addRow(["CA","Alice","Example",123,"a@example.invalid",9876543210]);s.getCell("D2").numFmt="000000";
  s.getCell("D4").value={formula:"1+1",result:2};s.getCell("E4").value="bad@example.invalid";
  s.getCell("D6").value=123;s.getCell("D6").numFmt="0.00E+00";
  s.getCell("D8").value=new Date("2026-01-01T00:00:00Z");
  s.getCell("D10").value={error:"#VALUE!"};s.getCell("D12").value=Number.MAX_SAFE_INTEGER+1;
  s.getCell("D14").value={formula:"NOW()"};s.getCell("D16").value=-1;s.getCell("D16").numFmt="000000";
  const bytes=new Uint8Array(await w.xlsx.writeBuffer());const cells=await importCells(bytes,"members.xlsx",{rowErrors:true});
  assert.equal(cells[1][3],"000123");assert.equal(cells[1][5],"9876543210");assert.deepEqual(cells.sourceRows,[1,2,4,6,8,10,12,14,16]);assert.match(cells.cellErrors![4],/Formula/);assert.equal(mapMembers(cells,cells.sourceRows,cells.cellErrors)[1].fieldErrors.file,"Formula cells are not accepted.");
  assert.match(cells.cellErrors![6],/numeric display/);assert.match(cells.cellErrors![8],/Date/);assert.match(cells.cellErrors![10],/Excel error/);assert.match(cells.cellErrors![12],/unsafe numeric/);
  assert.match(cells.cellErrors![14],/Formula/);assert.match(cells.cellErrors![16],/negative/);
  await assert.rejects(()=>importCells(bytes,"members.xlsx"),/Formula/);
});
test("editorial serializers never expose private member data or unknown keys",()=>{
  const body={...personBody({name:"Alice Example"}),email:"private@example.invalid",mobile:"+919876543210",addresses:{correspondence:{line1:"Private"}},membershipNumber:"123",futureSecret:"private"};
  for(const safe of [publicPerson(body as never),redactPerson(body as never)]) for(const key of ["email","mobile","addresses","membershipNumber","futureSecret"]) assert.ok(!(key in safe));
});
test("8–128 password boundaries and Professional-only policy writes",()=>{
  assert.ok(passwordError("a".repeat(7)));assert.equal(passwordError("a".repeat(8)),"");assert.equal(passwordError("a".repeat(128)),"");assert.ok(passwordError("a".repeat(129)));
  assert.ok(initialFields.every(f=>f.categories.every(c=>c==="Professional")));assert.ok(!initialFields.some(f=>f.documentKind==="student_evidence"));
  assert.throws(()=>validateFields([{...initialFields[0],categories:["Student"]}]));
  assert.equal(validateAnswers({phone:"9876543210"},initialFields).phone,memberInput(valid).mobile);
  const legacy=validateAnswers({phone:"1234567890",fullName:" Alice   Example ",organization:"Example  & Co"},initialFields,{phone:"1234567890"});assert.equal(legacy.phone,"1234567890");assert.equal(legacy.fullName,"Alice Example");assert.equal(legacy.organization,"Example & Co");
  assert.throws(()=>validateAnswers({phone:"22345"},initialFields,{phone:"1234567890"}),MemberValidationError);
});
