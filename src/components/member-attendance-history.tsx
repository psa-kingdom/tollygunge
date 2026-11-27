"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import type { EventJourney } from "./member-event-journey";
import { StatusBadge } from "./portal-values";
import styles from "./member-review.module.css";
const attendanceDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
});
type History = Pick<EventJourney, "historicalAttendance" | "attendedEvents">;
export function MemberAttendanceHistory({ personId }: { personId: string }) {
  const [result, setResult] = useState<{ personId: string; data?: History; error?: string }>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    api<History>(`/api/staff/member-attendance?personId=${encodeURIComponent(personId)}`)
      .then(data => { if (active) setResult({ personId, data }); })
      .catch(error => { if (active) setResult({ personId, error: error.message }); });
    return () => { active = false; };
  }, [personId, retry]);
  const current = result?.personId === personId ? result : undefined;
  const records = [
    ...(current?.data?.attendedEvents ?? []).map(event => ({
      id: event.id, title: event.title, date: event.starts_at, source: "Event check-in",
    })),
    ...(current?.data?.historicalAttendance ?? []).map(event => ({
      id: "historical-" + event.date, title: event.title,
      date: event.date + "T12:00:00+05:30", source: "Historical register",
    })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return <section className={styles.attendanceHistory} aria-label="Member event attendance">
    <div className={styles.contactHeading}>
      <h4>Event attendance</h4>
      {current?.data && <span className={styles.attendanceCount}>{records.length} {records.length === 1 ? "record" : "records"}</span>}
    </div>
    {current?.error ? <p role="alert">{current.error} <button type="button" onClick={() => { setResult(undefined); setRetry(value => value + 1); }}>Retry attendance</button></p> : !current?.data ? <p role="status">Loading attendance history…</p> : <>
      {records.length ? (
        <div className={styles.attendanceTableWrap} role="region" aria-label="Attendance history, newest first" tabIndex={0}>
          <table className={styles.attendanceTable}>
            <caption className="sr-only">Attended events, newest first</caption>
            <thead><tr><th scope="col">Event</th><th scope="col">Date</th><th scope="col">Attendance</th></tr></thead>
            <tbody>
              {records.map(event => (
                <tr key={event.id}>
                  <td><strong>{event.title}</strong><small>{event.source}</small></td>
                  <td><time dateTime={event.date}>{attendanceDate.format(new Date(event.date))}</time></td>
                  <td><StatusBadge tone="success">Attended</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.attendanceEmpty}>
          <h4>No attendance recorded yet</h4>
          <p>Events will appear here when this member’s attendance is recorded.</p>
        </div>
      )}
    </>}
  </section>;
}
