import { staffNavigation } from "./staff-navigation";
export type PortalDestination = { label: string; href: string };
export type PortalGroup = { label: string; items: PortalDestination[] };
const workspace = (label: string, slug: string): PortalDestination => ({
  label,
  href: `/admin/workspaces/${slug}`,
});
const admin: PortalGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/admin" },
      workspace("Reports", "reports"),
    ],
  },
  {
    label: "Members",
    items: [
      workspace("Member register", "members"),
      {
        label: "Account directory",
        href: "/admin/workspaces/members?view=accounts",
      },
      workspace("Verification", "verification"),
      workspace("Bulk onboarding", "onboarding"),
    ],
  },
  {
    label: "Events",
    items: [
      workspace("Events", "events"),
      workspace("Flyers", "flyers"),
      workspace("Historical imports", "imports"),
    ],
  },
  {
    label: "Publishing",
    items: [
      workspace("Content", "content"),
      workspace("Media library", "media"),
      workspace("Committees & people", "governance"),
    ],
  },
  {
    label: "Communications",
    items: [
      workspace("Communications", "communications"),
      workspace("Inquiries", "crm"),
      workspace("Email settings", "onboarding-email"),
    ],
  },
  { label: "Finance", items: [workspace("Payments", "payments")] },
  {
    label: "Settings",
    items: [
      workspace("Website settings", "website"),
      workspace("Staff access", "access"),
    ],
  },
];
export function portalNavigation(roles: readonly string[]): PortalGroup[] {
  if (!roles.length)
    return [
      { label: "Overview", items: [{ label: "Overview", href: "/member" }] },
      {
        label: "Membership",
        items: [
          { label: "Verification", href: "/member/application" },
          { label: "Payment details", href: "/member/payments" },
        ],
      },
      { label: "Events", items: [{ label: "Events", href: "/member/events" }] },
      {
        label: "Inquiries",
        items: [{ label: "Inquiries", href: "/member/inquiries" }],
      },
      {
        label: "Account",
        items: [
          { label: "Profile", href: "/account/profile" },
          { label: "Security", href: "/member/security" },
        ],
      },
    ];
  const allowed = new Set(
    staffNavigation(roles).flatMap((group) =>
      group.items.map((item) => item.href),
    ),
  );
  return admin
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowed.has(item.href.split("?")[0])),
    }))
    .filter((group) => group.items.length);
}
export function deploymentEnvironment(
  value?: string,
): "local" | "testing" | "production" | undefined {
  return value === "local" || value === "testing" || value === "production"
    ? value
    : undefined;
}
