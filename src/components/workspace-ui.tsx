import Link from "next/link";
import type { ReactNode } from "react";
import { PortalIcon } from "./portal-icon";
import styles from "./workspace-ui.module.css";

const workspaces: Record<string, { icon: string; description: string }> = {
  members: { icon: "people", description: "Manage membership records, account details and invitations." },
  verification: { icon: "shield", description: "Review submitted profiles, manage verification requirements and track decisions." },
  onboarding: { icon: "upload", description: "Import a member workbook or prepare new accounts, then review each batch before committing." },
  crm: { icon: "message", description: "Review inquiries, assign an owner and keep follow-ups on track." },
  communications: { icon: "mail", description: "Manage conversations, prepare campaigns and templates, and track delivery." },
  events: { icon: "calendar", description: "Create and publish events, manage registrations and record attendance." },
  flyers: { icon: "image", description: "Choose an event, prepare its flyer and review the preview before sharing or exporting." },
  imports: { icon: "upload", description: "Validate historical attendance and learning records before importing." },
  website: { icon: "file", description: "Edit website settings and resources, preview changes and publish when ready." },
  content: { icon: "file", description: "Organize website content, edit drafts and review each page before publication." },
  media: { icon: "image", description: "Upload, organize and publish the images and files used by your website." },
  governance: { icon: "people", description: "Manage people, committees and public profile publication." },
  payments: { icon: "wallet", description: "Review event payment references and manage association payment instructions." },
  "onboarding-email": { icon: "mail", description: "Configure approved test recipients and review transactional email delivery." },
  reports: { icon: "chart", description: "Choose a dataset, apply filters and export results or save a reusable report." },
  access: { icon: "shield", description: "Review staff permissions and administrative activity. Access changes take effect immediately." },
};

export function WorkspacePageHeading({ workspace, title }: { workspace: string; title: string }) {
  const presentation = workspaces[workspace];
  return <header className={styles.pageHeading}>
    <span className={styles.headingIcon}><PortalIcon name={presentation?.icon ?? "file"} /></span>
    <div><h1>{title}</h1><p>{presentation?.description}</p></div>
  </header>;
}

export function WorkspacePanel({ title, description, children, actions, className = "", id }: {
  title?: string; description?: string; children: ReactNode; actions?: ReactNode; className?: string; id?: string;
}) {
  return <section id={id} className={`${styles.panel} workspace-panel ${className}`}>
    {(title || actions) && <div className={styles.panelHeading}>
      <div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{actions}
    </div>}
    {children}
  </section>;
}

export function WorkspaceEmptyState({ icon = "file", title, description, actionLabel, href, onAction, secondaryLabel, secondaryHref, compact = false }: {
  icon?: string; title: string; description: string; actionLabel?: string; href?: string; onAction?: () => void;
  secondaryLabel?: string; secondaryHref?: string; compact?: boolean;
}) {
  const Heading = compact ? "h3" : "h2";
  return <div className={`${styles.emptyState} workspace-empty-state ${compact ? styles.compact : ""}`}>
    <span className={styles.emptyIcon}><PortalIcon name={icon} /></span>
    <Heading>{title}</Heading><p>{description}</p>
    {(actionLabel || secondaryLabel) && <div className={styles.emptyActions}>
      {actionLabel && (href ? <Link className="button" href={href}>{actionLabel}<PortalIcon name="arrow" /></Link> : onAction ? <button className="button" type="button" onClick={onAction}>{actionLabel}</button> : null)}
      {secondaryLabel && secondaryHref && <Link className="button secondary" href={secondaryHref}>{secondaryLabel}</Link>}
    </div>}
  </div>;
}

export function WorkspaceSteps({ steps, current, onStepChange, canVisit }: { steps: string[]; current: number; onStepChange?: (step: number) => void; canVisit?: (step: number) => boolean }) {
  return <ol className={styles.steps} aria-label="Workflow progress">{steps.map((step, index) =>
    <li key={step} aria-current={index === current ? "step" : undefined} data-complete={index < current || undefined}>
      {onStepChange ? <button type="button" className="workspace-step-button" disabled={canVisit ? !canVisit(index) : false} aria-current={index === current ? "step" : undefined} onClick={() => onStepChange(index)}><span>{index < current ? "✓" : index + 1}</span><strong>{step}</strong></button> : <><span>{index < current ? "✓" : index + 1}</span><strong>{step}</strong></>}
    </li>,
  )}</ol>;
}
