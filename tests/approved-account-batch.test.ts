import test from "node:test";
import assert from "node:assert/strict";
import { mapMembers, memberHeaders } from "../src/domain/member-import";
const row = (email: string, number: string) => [
  "CA",
  "First",
  "Member",
  number,
  email,
  "",
  "Partner",
  "Firm",
  "Old address",
  "India",
  "West Bengal",
  "Unknown city",
  "700001",
];
test("approved batch reserves the first physical email occurrence even when invalid", () => {
  const first = row(" SAME@example.invalid ", "001");
  first[1] = "";
  const rows = mapMembers(
    [
      memberHeaders,
      row("other@example.invalid", "002"),
      first,
      row("same@example.invalid", "003"),
    ],
    [1, 9, 2, 12],
    {},
    true,
  );
  assert.ok(rows[1].fieldErrors.firstName);
  assert.equal(rows[0].fieldErrors.email, undefined);
  assert.equal(rows[2].status, "conflict");
  assert.match(rows[2].fieldErrors.email, /later row is held/);
});
test("approved email policy leaves duplicate membership numbers held and normal imports strict", () => {
  const cells = [
    memberHeaders,
    row("same@example.invalid", "001"),
    row("SAME@example.invalid", "002"),
  ];
  assert.equal(mapMembers(cells)[0].status, "conflict");
  assert.equal(
    mapMembers(cells, undefined, {}, true)[0].fieldErrors.email,
    undefined,
  );
  const numbers = mapMembers(
    [
      memberHeaders,
      row("a@example.invalid", "001"),
      row("b@example.invalid", "001"),
    ],
    undefined,
    {},
    true,
  );
  assert.ok(numbers.every((r) => r.status === "conflict"));
});
