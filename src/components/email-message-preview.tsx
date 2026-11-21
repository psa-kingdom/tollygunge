import styles from "./communications.module.css";
export function EmailMessagePreview({
  subject,
  body,
  to = "Your selected recipients",
}: {
  subject: string;
  body: string;
  to?: string;
}) {
  return (
    <section className={styles.emailPreview} aria-label="Email message preview">
      <div className={styles.previewLabel}>MESSAGE PREVIEW</div>
      <div className={styles.envelope}>
        <h3>{subject || "Your subject line"}</h3>
        <p>
          <strong>TPA</strong> <span>updates@updates.tpassociation.org</span>
        </p>
        <p>To: {to}</p>
      </div>
      <div className={styles.emailBody}>
        {body || "Your message will appear here as you write."}
      </div>
      <footer>
        Tollygunge Professional Association
        <span>
          Newsletter preferences and unsubscribe links are added to campaign
          emails.
        </span>
      </footer>
    </section>
  );
}
