import test from "node:test";
import assert from "node:assert/strict";
import { existingMemberRows, memberHeaders } from "../src/domain/existing-member-import";
const row = (email: string, number: string) => [" CA "," Alice ","Example",number,email,"+91 9999999999","Partner","Example & Co","1 Example Road","India","West Bengal","Kolkata","700001"];
test("member import preserves source, text numbers and incomplete facts without plan or consent", () => {
  const r = existingMemberRows([memberHeaders,row("ALICE@example.invalid ","000123")])[0];
  assert.equal(r.name,"Alice Example"); assert.equal(r.member?.prefix,"CA"); assert.equal(r.email,"alice@example.invalid");
  assert.equal(r.membershipNumber,"000123"); assert.equal(r.source.Prefix," CA ");
  assert.equal(r.plan,undefined); assert.equal(r.details.district,undefined); assert.equal(r.error,undefined);
  assert.ok(r.normalizations.length > 0);
});
test("all source duplicate email and membership groups are held", () => {
  const rows = existingMemberRows([memberHeaders,row("alice@example.invalid","1"),row("ALICE@example.invalid","2"),row("third@example.invalid","2")]);
  assert.ok(rows.every(r => r.error));
  assert.match(rows[0].error!,/Duplicate email/); assert.match(rows[2].error!,/Duplicate membership/);
});
test("malformed cells are held while address hierarchy validation is deferred to database preview", () => {
  const values = row("alice@example.invalid","1"); values[10]="";
  const r = existingMemberRows([memberHeaders,values])[0]; assert.equal(r.member?.addresses.correspondence?.state,""); assert.equal(r.error,undefined);
  values[12]="700001"; values[1]="=formula"; assert.match(existingMemberRows([memberHeaders,values])[0].error!,/Formula/);
});
