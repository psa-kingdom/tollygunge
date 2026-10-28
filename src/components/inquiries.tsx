"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import { useSearchParams } from "next/navigation";
import { IssueContext } from "./issue-context";
import { issueMessage, issuePrompt } from "@/domain/issue-report";
type Inquiry = {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};
export function Inquiries() {
  const issueMode = useSearchParams().get("type") === "issue";
  const [diagnostics, setDiagnostics] = useState("");
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
      {issueMode && <p>Describe what you expected, what happened and the steps to reproduce it. Do not include passwords, identity documents or payment information.</p>}
      <form key={issueMode ? "issue" : "inquiry"}
        className="member-settings"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            data = new FormData(form);
          setBusy(true);
          try {
            const details = String(data.get("message") || "");
            if (issueMode && details.trim() === issuePrompt.trim()) throw new Error("Describe the issue before sending your report.");
            const saved = await api<Inquiry>("/api/member/inquiries", {
              subject: issueMode ? `[Website issue] ${String(data.get("subject") || "").replace(/^\[Website issue\]\s*/, "")}` : data.get("subject"),
              message: issueMode ? issueMessage(details, diagnostics, !!diagnostics) : details,
            });
            setItems(await api<Inquiry[]>("/api/member/inquiries"));
            form.reset();
            setDiagnostics("");
            setMessage(issueMode ? `Inquiry saved. Reference: ${saved.id}. You can track its status here.` : "Inquiry saved. You can track its status here.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Save failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Subject
          <input name="subject" required minLength={3} maxLength={issueMode ? 144 : 160} defaultValue={issueMode ? "Website issue" : ""} />
        </label>
        <label>
          {issueMode ? "Issue details" : "Message"}
          <textarea name="message" required minLength={10} maxLength={issueMode ? 3500 : 4000} rows={issueMode ? 9 : 4} defaultValue={issueMode ? issuePrompt : ""} />
        </label>
        {issueMode && <IssueContext key={items.length} onChange={setDiagnostics} />}
        <button className="button" disabled={busy || !ready}>
          {issueMode ? "Send issue report" : "Send inquiry to TPA"}
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
