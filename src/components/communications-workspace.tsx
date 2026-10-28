"use client";
import { WorkspaceEmptyState } from "./workspace-ui";
import { useState, useEffect, useRef } from "react";
import { api } from "./operations-client";
import { CampaignWorkspace } from "./campaign-workspace";
import { EmailInbox } from "./email-inbox";
import { EmailDeliveries } from "./email-deliveries";
import { useEmailEditGuard } from "./email-edit-guard";
import {InvitationTemplateEditor} from './invitation-template-editor';
type Template = {
  id?: string;
  version: number;
  name: string;
  subject: string;
  body: string;
};
const empty: Template = { version: 0, name: "", subject: "", body: "" };
export function CommunicationsWorkspace({canManageInvitations=false}:{canManageInvitations?:boolean}) {
  const deliveryDialog = useRef<HTMLDialogElement>(null);
  const [deliveryEnabled, setDeliveryEnabled] = useState<boolean | null>(null);
  const [detailsError, setDetailsError] = useState(false);
  const tabs = ["inbox", "campaigns", "templates", "invitations", "delivery"] as const;
  const [view, setView] = useState<(typeof tabs)[number]>("inbox");
  const [inboxDirty, setInboxDirty] = useState(false),
    [campaignDirty, setCampaignDirty] = useState(false),
    [invitationDirty,setInvitationDirty]=useState(false),
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
    inboxDirty || invitationDirty ||
      campaignDirty ||
      JSON.stringify(form) !== JSON.stringify(savedTemplate),
  );
  useEffect(() => {
    api<{ templates: Template[]; optedIn: number; recoveryEnabled: boolean; deliveryEnabled: boolean }>(
      "/api/staff/communications",
    )
      .then((data) => {
        if(new URLSearchParams(location.search).has('invitationTemplate'))setView('invitations');
        if (new URLSearchParams(location.search).has("campaign"))
          setView("campaigns");
        const templateId = new URLSearchParams(location.search).get("template");
        const chosen = data.templates.find((t) => t.id === templateId);
        if (chosen) {
          setView("templates");
          setForm(chosen);
          setSavedTemplate(chosen);
        }
        setTemplates(data.templates);
        setOptedIn(data.optedIn);
        setRecoveryEnabled(data.recoveryEnabled);
        setDeliveryEnabled(data.deliveryEnabled);
        setMessage("");
      })
      .catch((e) => { setDetailsError(true); setMessage(e.message); });
  }, []);
  return (
    <section className="communications-workspace">
      <div className="communications-toolbar">
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
                invitations: "Member invitations",
                delivery: "Delivery logs",
              }[tab]
            }
          </button>
        ))}
      </div>
      <button type="button" className="button secondary" aria-haspopup="dialog" onClick={() => deliveryDialog.current?.showModal()}>
        Delivery details
      </button>
      </div>
      <dialog ref={deliveryDialog} className="communications-details-dialog" aria-labelledby="delivery-details-title" aria-describedby="delivery-details-description">
        <header>
          <div>
            <h2 id="delivery-details-title">Delivery details</h2>
            <p id="delivery-details-description">Email setup, newsletter subscribers and sending rules.</p>
          </div>
          <button type="button" className="button secondary" autoFocus onClick={() => deliveryDialog.current?.close()}>Close</button>
        </header>
        {detailsError ? <p role="status">Delivery details could not be loaded. Refresh the page to try again.</p> : <>
          <section>
            <h3>Email setup</h3>
            <dl>
              <div><dt>Campaign sending</dt><dd>{deliveryEnabled === null ? "Checking setup…" : deliveryEnabled ? "Enabled" : "Not enabled"}</dd></div>
              <div><dt>Password-reset emails</dt><dd>{recoveryEnabled === null ? "Checking setup…" : recoveryEnabled ? "Configured" : "Sender setup needed"}</dd></div>
            </dl>
            {(deliveryEnabled === false || recoveryEnabled === false) && <p>Ask your technical administrator to complete the email setup for the services marked above. You can still prepare and save campaign drafts.</p>}
          </section>
          <section>
            <h3>Newsletter subscribers</h3>
            <p>{deliveryEnabled === null ? "Loading subscriber count…" : <><strong>{optedIn}</strong> {optedIn === 1 ? "account has" : "accounts have"} opted in to the newsletter.</>}</p>
            <p>To receive a campaign, subscribers also need a verified email address and optional emails turned on. Consent and preferences are checked again before every send.</p>
          </section>
          <section>
            <h3>Before sending</h3>
            <p>Review the saved campaign and its audience before dispatch. Follow each message’s delivery status in the Delivery logs tab.</p>
            <p>Official WhatsApp sending is not enabled.</p>
          </section>
        </>}
      </dialog>
      <div
        id="communications-templates-panel"
        role="tabpanel"
        aria-labelledby="communications-templates-tab"
        hidden={view !== "templates"}
      >
        <div className="operations-layout">
          <aside className="record-list">
            <button
              className="button"
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
            {!templates.length && <WorkspaceEmptyState compact icon="mail" title="No saved templates" description="Create a reusable email draft in the editor. Saving a template does not send it." />}
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
      <div id="communications-invitations-panel" role="tabpanel" aria-labelledby="communications-invitations-tab" hidden={view!=='invitations'}>{canManageInvitations?<InvitationTemplateEditor onDirtyChange={setInvitationDirty} />:<p>Only administrators can configure and approve member invitations.</p>}</div>
      {guard.dialog}
      {templateGuard.dialog}
    </section>
  );
}
