"use client";

import { useEffect, useState } from "react";
import Link from "./navigation-link";

type Item = { id: string; label: string; href: string; category: string; priority: string; count: number };

export function DashboardAttention({ initialItems, workspaceCount }: { initialItems: Item[]; workspaceCount: number }) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState(false);
  useEffect(() => {
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
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally { loading = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return <div className="dashboard-bento">
    <section className="bento-card bento-primary" aria-labelledby="dashboard-attention-title">
      <span className="eyebrow">YOUR NEXT ACTION</span><h2 id="dashboard-attention-title">Needs attention</h2>
      <p className="dashboard-alert-help">New sign-ups appear here while they complete their details. Submitted applications go to Verification for administrator review.</p>
      {items.length ? items.map(item => <Link className="attention-row" data-tone={item.count > 0 && (["verification", "profile-reviews", "membership-records"].includes(item.id) || item.priority.toLowerCase() === "high") ? "warning" : "blue"} key={item.id} href={item.href}><span>{item.label}</span><small>{item.category} · {item.priority} <span className="attention-arrow" aria-hidden="true">→</span></small></Link>) : <p>You’re up to date in your permitted workspaces.</p>}
      {error && <p role="status">Unable to refresh alerts. Showing the last available update.</p>}
    </section>
    <section className="bento-card bento-status">
      <span className="eyebrow">WORKSPACE STATUS</span><h2>{items.length}</h2><p>Active alerts needing attention</p><p>{workspaceCount} permitted workspaces</p>
      <div className="portal-account-shortcuts"><Link href="/account/profile" className="text-link">Your profile →</Link><Link href="/member/security" className="text-link">Account security →</Link></div>
    </section>
  </div>;
}
