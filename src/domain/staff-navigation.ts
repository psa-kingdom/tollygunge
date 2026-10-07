import { hasPermission, type Permission } from "./access";
const groups: {
  label: string;
  items: {
    label: string;
    href: string;
    icon: string;
    permission?: Permission;
  }[];
}[] = [
  {
    label: "Workspace",
    items: [{ label: "Overview", href: "/admin", icon: "home" }],
  },
  {
    label: "Community",
    items: [
      {
        label: "Members",
        href: "/admin/workspaces/members",
        icon: "people",
        permission: "members:review",
      },
      {
        label: "Inquiries",
        href: "/admin/workspaces/crm",
        icon: "message",
        permission: "communications:manage",
      },
      {
        label: "Communications",
        href: "/admin/workspaces/communications",
        icon: "mail",
        permission: "communications:manage",
      },
    ],
  },
  {
    label: "Events & learning",
    items: [
      {
        label: "Events",
        href: "/admin/workspaces/events",
        icon: "calendar",
        permission: "events:manage",
      },
      {
        label: "Flyers",
        href: "/admin/workspaces/flyers",
        icon: "image",
        permission: "events:manage",
      },
      {
        label: "Historical imports",
        href: "/admin/workspaces/imports",
        icon: "upload",
        permission: "events:manage",
      },
    ],
  },
  {
    label: "Publishing",
    items: [
      {
        label: "Content",
        href: "/admin/workspaces/content",
        icon: "file",
        permission: "content:publish",
      },
      {
        label: "Media library",
        href: "/admin/workspaces/media",
        icon: "image",
        permission: "content:publish",
      },
      {
        label: "Committees & people",
        href: "/admin/workspaces/governance",
        icon: "people",
        permission: "content:publish",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Payment details",
        href: "/admin/workspaces/payments",
        icon: "wallet",
        permission: "payments:manage",
      },
      { label: "Reports", href: "/admin/workspaces/reports", icon: "chart" },
      {
        label: "Staff access",
        href: "/admin/workspaces/access",
        icon: "shield",
        permission: "staff:manage",
      },
    ],
  },
];
export function staffNavigation(roles: readonly string[]) {
  if (!roles.length) return [];
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.permission ||
          hasPermission(roles, item.permission) ||
          (item.href === "/admin/workspaces/governance" &&
            hasPermission(roles, "members:review")),
      ),
    }))
    .filter((group) => group.items.length);
}
export function staffWorkspaceLabel(workspace: string) {
  return (
    groups
      .flatMap((group) => group.items)
      .find((item) => item.href === `/admin/workspaces/${workspace}`)?.label ??
    "Staff workspace"
  );
}
