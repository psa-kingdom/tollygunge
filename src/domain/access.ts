export const roles = [
  "super_administrator",
  "administrator",
  "membership_reviewer",
  "content_editor",
  "event_operator",
  "communications_operator",
  "finance_operator",
] as const;
export type StaffRole = (typeof roles)[number];
export type Permission =
  | "members:review"
  | "content:publish"
  | "events:manage"
  | "communications:manage"
  | "payments:manage"
  | "documents:review"
  | "staff:manage"
  | "staff:roles"
  | "finance:approve";
const grants: Record<StaffRole, readonly Permission[]> = {
  super_administrator: ["members:review", "content:publish", "events:manage", "communications:manage", "payments:manage", "documents:review", "staff:manage", "staff:roles", "finance:approve"],
  administrator: [
    "members:review",
    "content:publish",
    "events:manage",
    "communications:manage",
    "payments:manage",
    "documents:review",
    "staff:manage",
  ],
  membership_reviewer: ["members:review", "documents:review"],
  content_editor: ["content:publish"],
  event_operator: ["events:manage"],
  communications_operator: ["communications:manage"],
  finance_operator: ["payments:manage"],
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

export function staffRoleLabel(role: string) { return role === "administrator" ? "Admin" : role === "super_administrator" ? "Super admin" : role.replaceAll("_", " "); }
