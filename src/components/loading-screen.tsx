import styles from "./loading-screen.module.css";
export function LoadingScreen() {
  return <div className={styles.placeholder} role="status" aria-live="polite">
    <span className={styles.label}>Loading content…</span>
    <div aria-hidden="true"><span /><span /><span /></div>
  </div>;
}
