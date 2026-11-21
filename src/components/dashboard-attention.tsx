"use client";

import { useEffect, useState } from "react";
import Link from "./navigation-link";
import { PortalIcon } from "./portal-icon";
import styles from "./dashboard-overview.module.css";

type Item = { id: string; label: string; href: string; category: string; priority: string; count: number };

export function DashboardAttention({ initialItems, workspaceCount, live = true }: { initialItems: Item[]; workspaceCount: number; live?: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    let loading = false;
    const refresh = async () => {
      if (document.hidden || loading) return;
      loading = true;
      try {
        const response = await fetch("/api/attention", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unable to refresh");
        const data = await response.json() as { items: Item[] };
        if (!controller.signal.aborted) { setItems(data.items); setError(false); }
      } catch (err: unknown) {
        if (controller.signal.aborted || (err as Error)?.name === "AbortError") return;
        setError(true);
      } finally { loading = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      try {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      } catch {
        // Ignore abort during unmount
      }
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [live]);
  const groups = [
    { priority: "High", title: "Priority", description: "Start here" },
    { priority: "Normal", title: "To review", description: "Keep things moving" },
    { priority: "Low", title: "When you’re ready", description: "Publishing & follow-ups" },
  ];
  const icons: Record<string, string> = { Finance: "wallet", Memberships: "people", Verification: "shield", Publication: "file", Inquiries: "message", Communications: "mail", Delivery: "mail", Account: "profile" };
  return <section className={styles.attention} id="attention" aria-labelledby="dashboard-attention-title">
    <header className={styles.heading}>
      <div><h2 id="dashboard-attention-title">Needs attention</h2><p>Your next actions, in order of priority.</p></div>
      <span className={styles.summary}>{items.length} open {items.length === 1 ? "task" : "tasks"}</span>
    </header>
    {groups.map(group => {
      const entries = items.filter(item => item.priority === group.priority);
      return entries.length > 0 && <section key={group.priority} className={styles.group} data-priority={group.priority} aria-label={group.title}>
        <div className={styles.groupHeading}><h3>{group.title}</h3><span>{group.description}</span></div>
        <ul className={styles.tasks}>{entries.map(item => <li key={item.id}>
          <span className={styles.taskIcon}><PortalIcon name={icons[item.category] ?? "file"} /></span>
          <div className={styles.taskText}><span>{item.category}</span><strong>{item.label}</strong></div>
          <Link className={styles.action} href={item.href} aria-label={`Review: ${item.label}`}>Review<PortalIcon name="arrow" /></Link>
        </li>)}</ul>
      </section>;
    })}
    {!items.length && <div className={styles.empty}><PortalIcon name="shield" /><div><strong>You’re all caught up</strong><p>No actions needed in your workspaces.</p></div></div>}
    <footer className={styles.status}><PortalIcon name="panel" /><span>Access to {workspaceCount} workspaces</span>{live && <span>Alerts update automatically</span>}</footer>
    {error && <p className={styles.refreshError} role="status">Unable to refresh alerts. Showing the last available update.</p>}
  </section>;
}
