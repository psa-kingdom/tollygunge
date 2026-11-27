import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission, canReadPrivateDocument, canReviewFinanceEntry, canWriteFinance, financeReviewScope } from "../src/domain/access";
import { roles, type Permission } from "../src/domain/access";
import { staffNavigation } from "../src/domain/staff-navigation";
test("every staff role has exactly its intended permission set", () => {
  const permissions: Permission[] = [
    "members:review",
    "content:publish",
    "events:manage",
    "communications:manage",
    "payments:manage",
    "documents:review",
    "staff:manage",
    "staff:roles",
    "finance:read",
    "finance:approve",
    "finance:approve-expenses",
  ];
  const expected = {
    super_administrator: permissions.filter(p => p !== "finance:approve-expenses"),
    administrator: permissions.filter(p=>p !== "staff:roles" && p !== "finance:approve" && p !== "finance:approve-expenses"),
    membership_reviewer: ["members:review", "documents:review"],
    content_editor: ["content:publish"],
    event_operator: ["events:manage"],
    communications_operator: ["communications:manage"],
    finance_operator: ["payments:manage", "finance:read"],
    finance_approver: ["finance:read", "finance:approve-expenses"],
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

test("Finance Approvers can review expenses without receiving payment-management permissions", () => {
  const scope = financeReviewScope(["finance_approver"]);
  const links = staffNavigation(["finance_approver"]).flatMap((group) => group.items.map((item) => item.href));
  assert.ok(links.includes("/admin/workspaces/payments"));
  assert.ok(!links.includes("/admin/workspaces/payment-details"));
  assert.equal(canReviewFinanceEntry(scope, { kind: "expenses", source: "admin" }), true);
  assert.equal(canReviewFinanceEntry(scope, { kind: "receipt", source: "member" }), false);
  assert.equal(canReviewFinanceEntry(scope, { kind: "refund", source: "admin" }), false);
  assert.equal(canReviewFinanceEntry(financeReviewScope(["super_administrator"]), { kind: "refund", source: "admin" }), true);
  assert.equal(canReviewFinanceEntry(financeReviewScope(["finance_operator"]), { kind: "receipt", source: "member" }), true);
});

test("holding both admin roles permits expense entry alongside review", () => {
  const dualRoles = ["administrator", "super_administrator"];
  assert.equal(canWriteFinance(dualRoles, true), true);
  assert.equal(canWriteFinance(dualRoles), false);
  assert.equal(canWriteFinance(["super_administrator"], true), false);
  assert.equal(canWriteFinance(["finance_approver"], true), false);
  assert.equal(canWriteFinance(["finance_operator"], true), true);
});
