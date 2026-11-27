export const roles = [
  "super_administrator",
  "administrator",
  "membership_reviewer",
  "content_editor",
  "event_operator",
  "communications_operator",
  "finance_operator",
  "finance_approver",
] as const;
export type StaffRole = (typeof roles)[number];
export type Permission =
  | "members:review"
  | "content:publish"
  | "events:manage"
  | "events:delete"
  | "communications:manage"
  | "payments:manage"
  | "documents:review"
  | "staff:manage"
  | "staff:roles"
  | "finance:read"
  | "finance:approve"
  | "finance:approve-expenses";
const grants: Record<StaffRole, readonly Permission[]> = {
  super_administrator: ["members:review", "content:publish", "events:manage", "events:delete", "communications:manage", "payments:manage", "documents:review", "staff:manage", "staff:roles", "finance:read", "finance:approve"],
  administrator: [
    "members:review",
    "content:publish",
    "events:manage",
    "events:delete",
    "communications:manage",
    "payments:manage",
    "finance:read",
    "documents:review",
    "staff:manage",
  ],
  membership_reviewer: ["members:review", "documents:review"],
  content_editor: ["content:publish"],
  event_operator: ["events:manage"],
  communications_operator: ["communications:manage"],
  finance_operator: ["payments:manage", "finance:read"],
  finance_approver: ["finance:read", "finance:approve-expenses"],
};
export function hasPermission(
  userRoles: readonly string[],
  permission: Permission,
): boolean {
  return userRoles.some(
    (role) =>
      roles.includes(role as StaffRole) &&
      grants[role as StaffRole].includes(permission),
  );
}
export function canReadPrivateDocument(
  actor: { id: string; roles: readonly string[] } | null,
  ownerId: string,
): boolean {
  return (
    !!actor &&
    (actor.id === ownerId || hasPermission(actor.roles, "documents:review"))
  );
}

export function financeReviewScope(roles: readonly string[]) {
  if (hasPermission(roles, "finance:approve")) return "staff";
  if (hasPermission(roles, "finance:approve-expenses")) return "expenses";
  return "member";
}

export function canWriteFinance(roles: readonly string[], expenses = false) {
  return hasPermission(roles, "payments:manage") && (
    financeReviewScope(roles) === "member" ||
    (expenses && roles.includes("administrator") && roles.includes("super_administrator"))
  );
}

export function canReviewFinanceEntry(
  scope: ReturnType<typeof financeReviewScope>,
  entry: { source: string; kind: string },
) {
  if (scope === "member") return entry.source === "member";
  return entry.source !== "member" && (scope === "staff" || entry.kind === "expenses");
}

export function staffRoleLabel(role: string) { return role === "finance_approver" ? "Finance Approver" : role === "administrator" ? "Admin" : role === "super_administrator" ? "Super admin" : role.replaceAll("_", " "); }
