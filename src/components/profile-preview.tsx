"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { usePathname, useSearchParams } from "next/navigation";
import { CopyValue, StatusBadge } from "./portal-values";
import styles from "./portal-interactions.module.css";
export type ProfileSummary = {
  name: string;
  email?: string;
  phone?: string;
  number?: string;
  organization?: string;
  emailVerified?: boolean | null;
  profileVerified?: boolean;
  membershipStatus?: string | null;
};
export function ProfilePreview({
  profile,
  onPin,
  disabled = false,
  selected = false,
}: {
  profile: ProfileSummary;
  onPin: (trigger: HTMLButtonElement) => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  const pathname = usePathname(),
    query = useSearchParams();
  const previewKey = pathname + "?" + query + ":" + profile.name;
  const [opening, setOpening] = useState({ key: "", open: false });
  const open = opening.open && opening.key === previewKey;
  const setOpen = (value: boolean) =>
    setOpening({ key: previewKey, open: value });
  const { refs, floatingStyles, context } = useFloating({
    open: open && !disabled,
    onOpenChange: setOpen,
    placement: "right-start",
    strategy: "fixed",
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ["left-start", "bottom-start", "top-start"] }),
      shift({ padding: 12 }),
    ],
    whileElementsMounted: autoUpdate,
  });
  const { setReference, setFloating, reference } = refs;
  const hover = useHover(context, {
    enabled: !disabled,
    delay: { open: 180, close: 100 },
    handleClose: safePolygon({ buffer: 6 }),
    mouseOnly: true,
  });
  const focus = useFocus(context, { enabled: !disabled });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);
  const initials = profile.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (
    <>
      <button
        type="button"
        ref={setReference}
        className="link-button member-record-button"
        {...getReferenceProps({
          onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
            setOpen(false);
            onPin(event.currentTarget);
          },
          "aria-label": `Open ${profile.name} details`,
          "aria-pressed": selected,
        })}
      >
        <span className="member-record-avatar" aria-hidden="true">
          {initials}
        </span>
        <strong>{profile.name}</strong>
        <span aria-hidden="true">↗</span>
      </button>
      {open && !disabled && (
        <FloatingPortal>
          <FloatingFocusManager
            context={context}
            modal={false}
            initialFocus={-1}
            returnFocus={false}
          >
            <div
              ref={setFloating}
              style={floatingStyles}
              className={styles.quickCard}
              {...getFloatingProps()}
              aria-label={`${profile.name} quick preview`}
            >
              <div className={styles.previewHeading}>
                <span className="member-record-avatar" aria-hidden="true">
                  {initials}
                </span>
                <strong>{profile.name}</strong>
                <button
                  type="button"
                  aria-label="Close quick preview"
                  onClick={() => {
                    setOpen(false);
                    (reference.current as HTMLElement)?.focus();
                  }}
                >
                  ×
                </button>
              </div>
              {profile.organization && <p>{profile.organization}</p>}
              {profile.email && <CopyValue value={profile.email} />}
              {profile.phone && <CopyValue value={profile.phone} />}
              {profile.number && (
                <CopyValue value={profile.number} label="membership number" />
              )}
              <div className={styles.badges}>
                {profile.emailVerified != null && (
                  <StatusBadge
                    tone={profile.emailVerified ? "success" : "pending"}
                  >
                    {profile.emailVerified
                      ? "Email verified"
                      : "Email unverified"}
                  </StatusBadge>
                )}
                {profile.profileVerified != null && (
                  <StatusBadge
                    tone={profile.profileVerified ? "success" : "pending"}
                  >
                    {profile.profileVerified
                      ? "Profile verified"
                      : "Profile unverified"}
                  </StatusBadge>
                )}
                {profile.membershipStatus && (
                  <StatusBadge
                    tone={
                      profile.membershipStatus === "active"
                        ? "active"
                        : "neutral"
                    }
                  >
                    Membership: {profile.membershipStatus}
                  </StatusBadge>
                )}
              </div>
              <button
                className="button"
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPin(reference.current as HTMLButtonElement);
                }}
              >
                Open full details →
              </button>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

/** Non-modal beside the table on desktop; native focus-trapped sheet on small screens. */
export function ProfileInspector({
  children,
  label,
  onClose,
  returnFocus,
}: {
  children: React.ReactNode;
  label: string;
  onClose: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const first = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    first.current = document.activeElement as HTMLElement;
    const originalTrigger = returnFocus?.current ?? first.current;
    const media = matchMedia("(min-width: 1280px)");
    const sync = () => {
      if (media.matches) {
        dialog.current?.close();
        dialog.current?.setAttribute("open", "");
      } else {
        dialog.current?.close();
        dialog.current?.showModal();
      }
      dialog.current?.querySelector<HTMLElement>("h2,h3,button")?.focus();
    };
    sync();
    media.addEventListener("change", sync);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      media.removeEventListener("change", sync);
      document.removeEventListener("keydown", key);
      if (originalTrigger?.isConnected) originalTrigger.focus();
    };
  }, [returnFocus]);
  return (
    <dialog
      ref={dialog}
      className={`${styles.inspector} portal-inspector`}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={styles.inspectorBar}>
        <span>Profile details</span>
        <button type="button" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
