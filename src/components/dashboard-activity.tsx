"use client";

import { useState } from "react";
import type { ActivityItem } from "./admin-dashboard-view";
import { PortalIcon } from "./portal-icon";
import styles from "./dashboard-overview.module.css";

export function DashboardActivity({ activity }: { activity: ActivityItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? activity : activity.slice(0, 5);
  return <section className={styles.activity} id="activity" aria-labelledby="dashboard-activity-title">
    <header className={styles.heading}>
      <div><h2 id="dashboard-activity-title">Recent activity</h2><p>The latest updates across your workspace.</p></div>
      <span className={styles.summary}>{visible.length} of {activity.length} recent updates</span>
    </header>
    <ul className={styles.activityList} id="dashboard-activity-list">
      {visible.map((entry, index) => <li key={index}>
        <span className={styles.activityIcon}><PortalIcon name="file" /></span>
        <div><strong>{entry.action}</strong><span>{entry.name || "System"}</span></div>
        <time>{entry.time}</time>
      </li>)}
    </ul>
    {activity.length > 5 && <footer className={styles.footer}>
      <button type="button" className={styles.action} aria-expanded={expanded} aria-controls="dashboard-activity-list" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Show less activity" : "View more activity"}<PortalIcon name={expanded ? "close" : "chevron"} />
      </button>
    </footer>}
  </section>;
}
