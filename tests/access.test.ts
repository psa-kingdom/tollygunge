import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission, canReadPrivateDocument } from "../src/domain/access";
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
