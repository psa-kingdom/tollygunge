"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import { useEmailEditGuard } from "./email-edit-guard";
import { EmailMessagePreview } from "./email-message-preview";
import { PortalIcon } from "./portal-icon";
import {
  canSaveCampaign,
  type EmailTemplate,
} from "@/domain/communications-ui";
import styles from "./communications.module.css";
const blank: EmailTemplate = { version: 0, name: "", subject: "", body: "" };
export function EmailTemplates({
  onDirtyChange,
  onUse,
}: {
  onDirtyChange?: (dirty: boolean) => void;
  onUse: (template: EmailTemplate) => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]),
    [form, setForm] = useState(blank),
    [saved, setSaved] = useState(blank),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(saved),
    guard = useEmailEditGuard(dirty, false);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    api<{ templates: EmailTemplate[] }>("/api/staff/communications")
      .then((data) => {
        setTemplates(data.templates);
        const id = new URLSearchParams(location.search).get("template"),
          found = data.templates.find((t) => t.id === id);
        if (found) {
          setForm(found);
          setSaved(found);
          setEditing(true);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);
  function open(template = blank) {
    guard.proceed(() => {
      setForm(template);
      setSaved(template);
      setEditing(true);
      setNotice("");
      setError("");
    });
  }
  async function save() {
    if (
      !canSaveCampaign({
        ...form,
        audience: { city: "", profession: "" },
        status: "draft",
      })
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await api<EmailTemplate>("/api/staff/communications", {
        action: "save",
        ...form,
      });
      const entry = result;
      setForm(entry);
      setSaved(entry);
      setTemplates((rows) => [entry, ...rows.filter((t) => t.id !== entry.id)]);
      setNotice("Template saved. It is ready to use in a new email.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      {editing ? (
        <>
          <button
            className={`text-button ${styles.back}`}
            disabled={busy}
            onClick={() =>
              guard.proceed(() => {
                setEditing(false);
                setForm(blank);
                setSaved(blank);
                onDirtyChange?.(false);
              })
            }
          >
            ← All templates
          </button>
          <div className={styles.composerHeader}>
            <div>
              <h2>{saved.id ? "Edit template" : "New template"}</h2>
              <p>Save a reusable subject and message for future emails.</p>
            </div>
            <div className={styles.headerActions}>
              <button
                className="button secondary"
                disabled={busy || dirty || !saved.id}
                onClick={() => onUse(saved)}
              >
                Use in email
              </button>
              <button
                className="button gold"
                disabled={
                  busy ||
                  !dirty ||
                  !canSaveCampaign({
                    ...form,
                    audience: { city: "", profession: "" },
                    status: "draft",
                  })
                }
                onClick={() => void save()}
              >
                {busy ? "Saving…" : "Save template"}
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className={styles.notice}>
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className={styles.notice}>
              {notice}
            </p>
          )}
          <div className={styles.stage}>
            <form
              className={styles.formCard}
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  Template name
                  <input
                    value={form.name}
                    maxLength={100}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <small>
                    For your team only. Recipients will not see this name.
                  </small>
                </label>
                <label>
                  Subject
                  <input
                    value={form.subject}
                    maxLength={160}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                  />
                </label>
                <label>
                  Message
                  <textarea
                    value={form.body}
                    rows={13}
                    maxLength={6000}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                  />
                  <small>
                    {form.body.length.toLocaleString("en-IN")} / 6,000
                    characters · Plain text
                  </small>
                </label>
              </fieldset>
            </form>
            <EmailMessagePreview subject={form.subject} body={form.body} />
          </div>
        </>
      ) : (
        <>
          <header className={styles.sectionHeading}>
            <div>
              <h2>
                Templates{" "}
                <span className={styles.count}>{templates.length}</span>
              </h2>
              <p>Start with a saved message, then make it your own.</p>
            </div>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => open()}
            >
              ＋ New template
            </button>
          </header>
          {error && (
            <p role="alert" className={styles.notice}>
              {error}
            </p>
          )}
          {busy ? (
            <p role="status" className={styles.notice}>
              Loading templates…
            </p>
          ) : templates.length ? (
            <div className={styles.templateGrid}>
              {templates.map((t) => (
                <button
                  className={`text-button ${styles.templateCard}`}
                  key={t.id}
                  onClick={() => open(t)}
                >
                  <PortalIcon name="file" />
                  <strong>{t.name}</strong>
                  <span>{t.subject}</span>
                  <small>Edit template →</small>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <PortalIcon name="file" />
              <h3>A head start for your next email</h3>
              <p>
                Save messages you use often. Templates can be edited before each
                campaign.
              </p>
              <button className="button secondary" onClick={() => open()}>
                Create a template
              </button>
            </div>
          )}
        </>
      )}
      {guard.dialog}
    </section>
  );
}
