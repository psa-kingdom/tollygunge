import Link from "next/link";
import type { ReactNode } from "react";
import { PortalIcon } from "./portal-icon";
import styles from "./workspace-ui.module.css";

export function WorkspacePageHeading({ title }: {
  workspace: string;
  title: string;
  description?: string;
}) {
  return <h1 className="sr-only">{title}</h1>;
}

export function WorkspacePanel({
  title,
  description,
  children,
  actions,
  className = "",
  id,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`${styles.panel} workspace-panel ${className}`}
      data-portal-primary
    >
      {(title || actions) && (
        <div className={styles.panelHeading}>
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function WorkspaceEmptyState({
  icon = "file",
  title,
  description,
  actionLabel,
  href,
  onAction,
  secondaryLabel,
  secondaryHref,
  compact = false,
}: {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  href?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
  compact?: boolean;
}) {
  const Heading = compact ? "h3" : "h2";
  return (
    <div
      className={`${styles.emptyState} workspace-empty-state ${compact ? styles.compact : ""}`}
    >
      <span className={styles.emptyIcon}>
        <PortalIcon name={icon} />
      </span>
      <Heading>{title}</Heading>
      <p>{description}</p>
      {(actionLabel || secondaryLabel) && (
        <div className={styles.emptyActions}>
          {actionLabel &&
            (href ? (
              <Link className="button" href={href}>
                {actionLabel}

              </Link>
            ) : onAction ? (
              <button className="button" type="button" onClick={onAction}>
                {actionLabel}
              </button>
            ) : null)}
          {secondaryLabel && secondaryHref && (
            <Link className="button secondary" href={secondaryHref}>
              {secondaryLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkspaceSteps({
  steps,
  current,
  onStepChange,
  canVisit,
}: {
  steps: string[];
  current: number;
  onStepChange?: (step: number) => void;
  canVisit?: (step: number) => boolean;
}) {
  return (
    <ol className={styles.steps} aria-label="Workflow progress">
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? "step" : undefined}
          data-complete={index < current || undefined}
        >
          {onStepChange ? (
            <button
              type="button"
              className="workspace-step-button"
              disabled={canVisit ? !canVisit(index) : false}
              aria-current={index === current ? "step" : undefined}
              onClick={() => onStepChange(index)}
            >
              <span>{index < current ? "✓" : index + 1}</span>
              <strong>{step}</strong>
            </button>
          ) : (
            <>
              <span>{index < current ? "✓" : index + 1}</span>
              <strong>{step}</strong>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
