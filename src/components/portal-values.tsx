"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./portal-interactions.module.css";
export type StatusTone =
  "success" | "active" | "testing" | "pending" | "error" | "neutral";
export function StatusBadge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span className={`${styles.badge} ${className}`} data-tone={tone}>
      {children}
    </span>
  );
}
export function CopyValue({
  value,
  label,
  className = "",
}: {
  value?: string | null;
  label?: string;
  className?: string;
}) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!value) return <span className="muted">Not supplied</span>;
  return (
    <span className={`${styles.copyGroup} ${className}`}>
      <button
        type="button"
        data-copy-value
        className={`${styles.copy} text-button`}
        aria-label={`Copy ${label || value}`}
        title={`Copy ${label || value}`}
        onClick={async (event) => {
          event.stopPropagation();
          clearTimeout(timer.current);
          try {
            await navigator.clipboard.writeText(value);
            setMessage("Copied");
            timer.current = setTimeout(() => setMessage(""), 2400);
          } catch {
            setMessage(
              "Clipboard unavailable. Select the value and copy manually.",
            );
          }
        }}
      >
        <span>{value}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <rect x="6" y="6" width="10" height="11" rx="2" />
          <path d="M12 6V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
        </svg>
      </button>
      <span className={styles.copyMessage} role="status">
        {message}
      </span>
    </span>
  );
}
