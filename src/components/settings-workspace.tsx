import type { ReactNode } from "react";
import Link from "./navigation-link";
import { PortalIcon } from "./portal-icon";
import { portalNavigation } from "@/domain/portal-navigation";
import ui from "./communications.module.css";
import styles from "./settings-workspace.module.css";

export function SettingsWorkspace({
  workspace,
  roles,
  children,
}: {
  workspace: string;
  roles: string[];
  children: ReactNode;
}) {
  const destinations =
    portalNavigation(roles).find((group) => group.label === "Settings")
      ?.items ?? [];
  return (
    <section className={`${ui.workspace} ${styles.workspace}`}>
      <header className={ui.pageHeading}>
        <div>
          <h1>Settings</h1>
          <p>Manage collection accounts and staff access.</p>
        </div>
      </header>
      <div className={ui.layout}>
        <aside className={ui.sidebar}>
          <nav className={styles.navigation} aria-label="Settings">
            <span className={ui.navGroup}>ADMINISTRATION</span>
            {destinations.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  item.href.endsWith(`/${workspace}`) ? "page" : undefined
                }
              >
                <PortalIcon
                  name={item.href.endsWith("/access") ? "shield" : "wallet"}
                />
                {item.label}
              </Link>
            ))}
          </nav>
          <p className={styles.sidebarHelp}>
            Website pages, images and articles are managed in Publishing.
          </p>
        </aside>
        <div className={ui.content}>{children}</div>
      </div>
    </section>
  );
}
