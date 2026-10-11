import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission, canReadPrivateDocument } from "../src/domain/access";
import { roles, type Permission } from "../src/domain/access";
test("every staff role has exactly its intended permission set", () => {
  const permissions: Permission[] = [
    "members:review",
    "content:publish",
    "events:manage",
    "communications:manage",
    "payments:manage",
    "documents:review",
    "staff:manage",
  ];
  const expected = {
    administrator: permissions,
    membership_reviewer: ["members:review", "documents:review"],
    content_editor: ["content:publish"],
    event_operator: ["events:manage"],
    communications_operator: ["communications:manage"],
    finance_operator: ["payments:manage"],
  };
  for (const role of roles)
    for (const permission of permissions)
      assert.equal(
        hasPermission([role], permission),
        (expected[role] as string[]).includes(permission),
        `${role} / ${permission}`,
      );
});
test("staff roles only grant their domain permissions", () => {
  assert.equal(hasPermission(["membership_reviewer"], "members:review"), true);
  assert.equal(
    hasPermission(["membership_reviewer"], "payments:manage"),
    false,
  );
  assert.equal(hasPermission(["finance_operator"], "documents:review"), false);
  assert.equal(
    hasPermission(["member", "invented_role"], "staff:manage"),
    false,
  );
  assert.equal(hasPermission(["administrator"], "staff:manage"), true);
});
test("private documents reject anonymous users and other members", () => {
  assert.equal(canReadPrivateDocument(null, "member-a"), false);
  assert.equal(
    canReadPrivateDocument({ id: "member-b", roles: [] }, "member-a"),
    false,
  );
  assert.equal(
    canReadPrivateDocument({ id: "member-a", roles: [] }, "member-a"),
    true,
  );
  assert.equal(
    canReadPrivateDocument(
      { id: "staff", roles: ["membership_reviewer"] },
      "member-a",
    ),
    true,
  );
  assert.equal(
    canReadPrivateDocument(
      { id: "staff", roles: ["content_editor"] },
      "member-a",
    ),
    false,
  );
});
