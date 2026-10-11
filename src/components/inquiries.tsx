"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
type Inquiry = {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};
export function Inquiries() {
  const [items, setItems] = useState<Inquiry[]>([]),
    [message, setMessage] = useState("Loading inquiries…"),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    api<Inquiry[]>("/api/member/inquiries")
      .then(setItems)
      .then(() => {
        setMessage("");
        setReady(true);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <>
      <p>
        Your inquiry is saved to the TPA staff workspace. Email and WhatsApp
        replies will become available after provider setup.
      </p>
      <form
        className="member-settings"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            data = new FormData(form);
          setBusy(true);
          try {
            await api("/api/member/inquiries", {
              subject: data.get("subject"),
              message: data.get("message"),
            });
            setItems(await api<Inquiry[]>("/api/member/inquiries"));
            form.reset();
            setMessage("Inquiry saved. You can track its status here.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Save failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Subject
          <input name="subject" required minLength={3} maxLength={160} />
        </label>
        <label>
          Message
          <textarea name="message" required minLength={10} maxLength={4000} />
        </label>
        <button className="button" disabled={busy || !ready}>
          Send inquiry to TPA
        </button>
      </form>
      <p role="status">{message}</p>
      <h2>Your inquiries</h2>
      {ready && items.length === 0 && <p>No inquiries yet.</p>}
      {items.map((item) => (
        <article className="content-section" key={item.id}>
          <h3>{item.subject}</h3>
          <p className="prose-text">{item.message}</p>
          <p>
            {item.status.replaceAll("_", " ")} ·{" "}
            {new Date(item.created_at).toLocaleDateString("en-IN")}
          </p>
        </article>
      ))}
    </>
  );
}
