"use client";

import Link, { useLinkStatus } from "next/link";
import { useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import styles from "./navigation-link.module.css";

function PendingNavigation() {
  const { pending } = useLinkStatus();
  return pending ? createPortal(<span className={styles.progress} role="status"><span className={styles.label}>Opening page…</span></span>, document.body) : null;
}

/** Warm only intended destinations; leave routing, cancellation and modifiers to Link. */
export default function NavigationLink({ children, prefetch, onMouseEnter, onFocus, ...props }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  const localPage = typeof props.href === "string" && props.href.startsWith("/") && !props.href.startsWith("//") && !props.href.startsWith("/api/") && !props.href.startsWith("/downloads/");
  return <Link {...props} prefetch={prefetch ?? (localPage && intent)}
    onMouseEnter={event => { onMouseEnter?.(event); if (!event.defaultPrevented) setIntent(true); }}
    onFocus={event => { onFocus?.(event); if (!event.defaultPrevented) setIntent(true); }}>
    {children}<PendingNavigation />
  </Link>;
}
