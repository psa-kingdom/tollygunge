"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "./operations-client";
import { CampaignWorkspace } from "./campaign-workspace";
import { EmailInbox } from "./email-inbox";
import { EmailDeliveries } from "./email-deliveries";
import { useEmailEditGuard } from "./email-edit-guard";
type Template = {
  id?: string;
  version: number;
  name: string;
  subject: string;
  body: string;
};
const empty: Template = { version: 0, name: "", subject: "", body: "" };
export function CommunicationsWorkspace() {
  const tabs = ["inbox", "campaigns", "templates", "delivery"] as const;
  const [view, setView] = useState<(typeof tabs)[number]>("inbox");
  const [inboxDirty, setInboxDirty] = useState(false),
    [campaignDirty, setCampaignDirty] = useState(false),
    [savedTemplate, setSavedTemplate] = useState(empty);
  const [templates, setTemplates] = useState<Template[]>([]),
    [recoveryEnabled, setRecoveryEnabled] = useState<boolean | null>(null),
    [form, setForm] = useState(empty),
    [optedIn, setOptedIn] = useState(0),
    [message, setMessage] = useState("Loading templates…"),
    [busy, setBusy] = useState(false);
  const templateGuard = useEmailEditGuard(
    JSON.stringify(form) !== JSON.stringify(savedTemplate),
    false,
  );
  const guard = useEmailEditGuard(
    inboxDirty ||
      campaignDirty ||
      JSON.stringify(form) !== JSON.stringify(savedTemplate),
  );
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
        {recoveryEnabled === null
          ? "Checking recovery configuration. "
          : recoveryEnabled
            ? "Password recovery email is enabled. "
            : "Password recovery email awaits sender setup. "}
        Review saved campaigns before dispatch. Delivery is tracked separately;
        consent and preferences are rechecked before each send. Official
        WhatsApp remains gated.
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
        {tabs.map((tab) => (
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
                  ? tabs[0]
                  : event.key === "End"
                    ? tabs.at(-1)!
                    : tabs[
                        (tabs.indexOf(view) +
                          (event.key === "ArrowRight" ? 1 : -1) +
                          tabs.length) %
                          tabs.length
                      ];
              setView(next);
              document.getElementById(`communications-${next}-tab`)?.focus();
            }}
          >
            {
              {
                inbox: "Shared inbox",
                campaigns: "Campaigns",
                templates: "Email templates",
                delivery: "Delivery logs",
              }[tab]
            }
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
              onClick={() =>
                templateGuard.proceed(() => {
                  setForm(empty);
                  setSavedTemplate(empty);
                })
              }
            >
              New template
            </button>
            {templates.map((t) => (
              <button
                key={t.id}
                disabled={busy}
                onClick={() =>
                  templateGuard.proceed(() => {
                    setForm(t);
                    setSavedTemplate(t);
                  })
                }
              >
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
                  setSavedTemplate(saved);
                  setTemplates(
                    (
                      await api<{ templates: Template[] }>(
                        "/api/staff/communications",
                      )
                    ).templates,
                  );
                  setMessage(
                    "Template saved. Use it in a campaign draft before dispatch.",
                  );
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
        <CampaignWorkspace onDirtyChange={setCampaignDirty} />
      </div>
      <div
        id="communications-inbox-panel"
        role="tabpanel"
        aria-labelledby="communications-inbox-tab"
        hidden={view !== "inbox"}
      >
        <EmailInbox onDirtyChange={setInboxDirty} />
      </div>
      <div
        id="communications-delivery-panel"
        role="tabpanel"
        aria-labelledby="communications-delivery-tab"
        hidden={view !== "delivery"}
      >
        <EmailDeliveries />
      </div>
      {guard.dialog}
      {templateGuard.dialog}
    </>
  );
}
