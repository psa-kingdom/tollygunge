"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "./operations-client";
import { CampaignWorkspace } from "./campaign-workspace";
type Template = {
  id?: string;
  version: number;
  name: string;
  subject: string;
  body: string;
};
const empty: Template = { version: 0, name: "", subject: "", body: "" };
export function CommunicationsWorkspace() {
  const [view, setView] = useState<"campaigns" | "templates">("campaigns");
  const [templates, setTemplates] = useState<Template[]>([]),
    [recoveryEnabled, setRecoveryEnabled] = useState(false),
    [form, setForm] = useState(empty),
    [optedIn, setOptedIn] = useState(0),
    [message, setMessage] = useState("Loading templates…"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ templates: Template[]; optedIn: number; recoveryEnabled: boolean }>(
      "/api/staff/communications",
    )
      .then((data) => {
        setTemplates(data.templates);
        setOptedIn(data.optedIn);
        setRecoveryEnabled(data.recoveryEnabled);
        setMessage("");
      })
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <>
      <div className="notice">
        {recoveryEnabled
          ? "Password recovery email is enabled. "
          : "Password recovery email awaits sender setup. "}
        Campaigns and templates remain saved drafts. Campaign sending needs
        consent-safe delivery jobs, unsubscribe handling and delivery events.
        Shared inbox and official WhatsApp await setup.
      </div>
      <p>
        {optedIn} accounts currently consent to the newsletter. Campaign
        delivery will recheck consent before each send.
      </p>
      <Link href="/admin/workspaces/crm">
        Open CRM inquiries and follow-ups →
      </Link>
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label="Communication tools"
      >
        {(["campaigns", "templates"] as const).map((tab) => (
          <button
            key={tab}
            id={`communications-${tab}-tab`}
            role="tab"
            type="button"
            aria-selected={view === tab}
            aria-controls={`communications-${tab}-panel`}
            tabIndex={view === tab ? 0 : -1}
            onClick={() => setView(tab)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "campaigns"
                  : event.key === "End"
                    ? "templates"
                    : view === "campaigns"
                      ? "templates"
                      : "campaigns";
              setView(next);
              document.getElementById(`communications-${next}-tab`)?.focus();
            }}
          >
            {tab === "campaigns" ? "Campaign drafts" : "Email templates"}
          </button>
        ))}
      </div>
      <div
        id="communications-templates-panel"
        role="tabpanel"
        aria-labelledby="communications-templates-tab"
        hidden={view !== "templates"}
      >
        <div className="operations-layout">
          <aside className="record-list">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setForm(empty)}
            >
              New template
            </button>
            {templates.map((t) => (
              <button key={t.id} disabled={busy} onClick={() => setForm(t)}>
                <strong>{t.name}</strong>
                <small>{t.subject}</small>
              </button>
            ))}
          </aside>
          <section>
            <h2>Email template</h2>
            <form
              className="member-settings"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setMessage("");
                try {
                  const saved = await api<Template>(
                    "/api/staff/communications",
                    {
                      ...form,
                      action: "save",
                    },
                  );
                  setForm(saved);
                  setTemplates(
                    (
                      await api<{ templates: Template[] }>(
                        "/api/staff/communications",
                      )
                    ).templates,
                  );
                  setMessage("Template saved. Delivery remains disabled.");
                } catch (error) {
                  setMessage(
                    error instanceof Error ? error.message : "Save failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <fieldset className="plain-fieldset" disabled={busy}>
                <legend>Email template details</legend>
                <label>
                  Template name
                  <input
                    required
                    minLength={3}
                    maxLength={100}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  Subject
                  <input
                    required
                    minLength={3}
                    maxLength={160}
                    value={form.subject}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                  />
                </label>
                <label>
                  Message (plain text)
                  <textarea
                    required
                    minLength={10}
                    maxLength={6000}
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                  />
                </label>
                <button className="button" disabled={busy}>
                  Save draft template
                </button>
              </fieldset>
            </form>
            <p role="status">{message}</p>
            <h3>Preview</h3>
            <p>
              <strong>{form.subject || "Subject preview"}</strong>
            </p>
            <p className="prose-text">{form.body || "Message preview"}</p>
          </section>
        </div>
      </div>
      <div
        id="communications-campaigns-panel"
        role="tabpanel"
        aria-labelledby="communications-campaigns-tab"
        hidden={view !== "campaigns"}
      >
        <CampaignWorkspace />
      </div>
    </>
  );
}
