import { Brand } from "@/components/site-shell";
import { PortalFrame } from "@/components/portal-frame";
import { WorkspaceSearch } from "@/components/workspace-search";
import { AccountControls } from "@/components/account-controls";
import { PortalNavigation } from "@/components/portal-navigation";
import type { PortalGroup } from "@/domain/portal-navigation";

export const dynamic = "force-dynamic";

const previewActor = {
  id: "preview-admin",
  name: "Preview Admin",
  email: "admin@tpassociation.org",
  roles: ["administrator"],
  plan: "Patron",
};

const previewGroups: PortalGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/preview/admin" },
      { label: "Reports", href: "/preview/admin/workspaces/reports" },
    ],
  },
  {
    label: "Members",
    items: [
      { label: "Directory & Review", href: "/preview/admin/workspaces/members" },
    ],
  },
  {
    label: "Events",
    items: [
      { label: "Events Hub", href: "/preview/admin/workspaces/events" },
    ],
  },
  {
    label: "Publishing",
    items: [
      { label: "Content", href: "/preview/admin/workspaces/content" },
    ],
  },
  {
    label: "Communications",
    items: [
      { label: "CRM Inquiries", href: "/preview/admin/workspaces/crm" },
      { label: "Broadcasts", href: "/preview/admin/workspaces/communications" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Payment Details", href: "/preview/admin/workspaces/payments" },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Staff Access", href: "/preview/admin/workspaces/access" },
    ],
  },
];

export default function PreviewAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalFrame staff={true}>
      <div className="staff-content portal-content">
        <header className="workspace-topbar portal-topbar">
          <div className="portal-brand-row">
            <Brand compact />
          </div>
          <PortalNavigation
            groups={previewGroups}
            staff={true}
          />
          <div className="portal-utilities">
            <WorkspaceSearch />
            <AccountControls actor={previewActor} portal />
          </div>
        </header>
        {children}
      </div>
    </PortalFrame>
  );
}

