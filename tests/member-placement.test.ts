import test from "node:test";
import assert from "node:assert/strict";
import {
  memberSectors,
  memberSector,
  moveMemberPlacement,
  showMemberSection,
} from "../src/domain/people-placement";
import type { ProfileGroup } from "../src/domain/people";
const groups: ProfileGroup[] = [
  {
    id: "founding",
    parent_id: null,
    draft: { name: "Founding Members", page: "about", section: 2, order: 0 },
    published: null,
    archived: false,
    version: 1,
  },
  {
    id: "executive",
    parent_id: null,
    draft: {
      name: "Executive Committee",
      page: "governance",
      section: 0,
      order: 0,
    },
    published: null,
    archived: false,
    version: 1,
  },
  {
    id: "sub",
    parent_id: null,
    draft: { name: "Sub-Committees", page: "governance", section: 1, order: 1 },
    published: null,
    archived: false,
    version: 1,
  },
  {
    id: "child",
    parent_id: "sub",
    draft: { name: "Working group", page: "governance", section: 1, order: 2 },
    published: null,
    archived: false,
    version: 1,
  },
];
test("member sectors follow website placement and inherit subgroup placement", () => {
  assert.equal(memberSectors.length, 3);
  assert.equal(memberSector(groups[0], groups)?.id, "founding");
  assert.equal(memberSector(groups[1], groups)?.id, "executive");
  assert.equal(memberSector(groups[3], groups)?.id, "subcommittees");
  assert.equal(
    memberSector({ ...groups[3], parent_id: "missing" }, groups),
    undefined,
  );
});
test("moving a member preserves the role, term and unrelated assignments", () => {
  const original = [
    {
      groupId: "executive",
      role: "Secretary",
      term: "2026",
      order: 2,
      label: "Volunteer",
    },
    { groupId: "founding", role: "Founder", term: "", order: 0 },
  ];
  const result = moveMemberPlacement(original, ["executive"], "sub", 5);
  assert.deepEqual(result, [
    original[1],
    { ...original[0], groupId: "sub", order: 5 },
  ]);
  assert.equal(original[0].groupId, "executive");
  assert.equal(
    moveMemberPlacement(original, ["executive"], "executive", 5),
    original,
  );
  assert.throws(() => moveMemberPlacement(original, ["missing"], "sub", 0));
});
test("moving into an existing membership does not duplicate the destination group", () => {
  const assignments = [
    { groupId: "executive", role: "Member", term: "", order: 0 },
    { groupId: "sub", role: "Convenor", term: "2026", order: 1 },
  ];
  assert.deepEqual(moveMemberPlacement(assignments, ["executive"], "sub", 3), [
    assignments[1],
  ]);
});
test("empty public member sections disappear without hiding document or ordinary page sections", () => {
  assert.equal(showMemberSection("about", 2, []), false);
  assert.equal(showMemberSection("governance", 0, []), false);
  assert.equal(showMemberSection("governance", 1, []), false);
  assert.equal(showMemberSection("governance", 2, []), true);
  assert.equal(showMemberSection("about", 0, []), true);
  const people = [{ published: { page: "governance", section: 0 } }];
  assert.equal(showMemberSection("governance", 0, people), true);
  assert.equal(showMemberSection("governance", 1, people), false);
  assert.equal(showMemberSection("about", 2, people), false);
});
