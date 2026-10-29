import styles from "./portal-theme.module.css";
import layout from "./portal-horizontal.module.css";
/** Scoped portal boundary. Public pages never receive these tokens or styles. */
export function PortalFrame({ staff, children }: { staff: boolean; children: React.ReactNode }) {
  return <div className={`${styles.portal} ${layout.horizontal} workspace ${staff ? "staff-shell" : "member-shell"}`} data-navigation="horizontal">{children}</div>;
}
