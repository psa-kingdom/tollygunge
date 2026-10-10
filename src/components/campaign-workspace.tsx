"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import { CampaignDispatch } from "./campaign-dispatch";
import { useEmailEditGuard } from "./email-edit-guard";
type Audience = { city: string; profession: string };
type Campaign = {
  id?: string;
  version: number;
  name: string;
  subject: string;
  body: string;
  audience: Audience;
  status: "draft" | "archived";
};
type Revision = {
  version: number;
  snapshot: Campaign;
  created_at: string;
  actor_name: string;
};
type Preview = {
  matched: number;
  eligible: number;
  unsubscribed: number;
  unverified: number;
  preference_blocked: number;
  as_of: string;
  sample: { name: string; email: string }[];
  audience: Audience;
};
type Template = { id: string; name: string; subject: string; body: string };
const empty: Campaign = {
  version: 0,
  name: "",
  subject: "",
  body: "",
  audience: { city: "", profession: "" },
  status: "draft",
};
export function CampaignWorkspace({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [savedForm, setSavedForm] = useState(empty);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]),
    [form, setForm] = useState(empty);
  const [revisions, setRevisions] = useState<Revision[]>([]),
    [preview, setPreview] = useState<Preview>();
  const [templates, setTemplates] = useState<Template[]>([]),
    [templateId, setTemplateId] = useState("");
  const [status, setStatus] = useState("all"),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState("Loading campaign drafts…");
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const guard = useEmailEditGuard(dirty, false);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    let active = true;
    api<{ campaigns: Campaign[] }>("/api/staff/campaigns")
      .then((data) => {
        if (active) {
          setCampaigns(data.campaigns);
          const id = new URLSearchParams(location.search).get("campaign");
          if (id) void open(id);
          setMessage("");
        }
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function refresh() {
    const data = await api<{ campaigns: Campaign[] }>(
      `/api/staff/campaigns?status=${status}`,
    );
    setCampaigns(data.campaigns);
  }
  async function open(id: string) {
    setBusy(true);
    setMessage("");
    setPreview(undefined);
    try {
      const data = await api<{ entry: Campaign; revisions: Revision[] }>(
        `/api/staff/campaigns?id=${id}`,
      );
      setForm(data.entry);
      setSavedForm(data.entry);
      setRevisions(data.revisions);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function change(action: string) {
    setBusy(true);
    setMessage("");
    setPreview(undefined);
    try {
      const saved = await api<Campaign>("/api/staff/campaigns", {
        ...form,
        action,
      });
      setForm(saved);
      setSavedForm(saved);
      const detail = await api<{ revisions: Revision[] }>(
        `/api/staff/campaigns?id=${saved.id}`,
      );
      setRevisions(detail.revisions);
      await refresh();
      setMessage(
        action === "save"
          ? "Campaign draft saved. No messages were sent."
          : action === "archive"
            ? "Draft archived. History is retained."
            : "Draft restored for editing.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function field<K extends keyof Campaign>(key: K, value: Campaign[K]) {
    setForm({ ...form, [key]: value });
    setPreview(undefined);
  }
  return (
    <section className="content-section" aria-label="Campaign drafts">
      <h2>Campaign drafts</h2>
      <p>
        Prepare a newsletter, review its saved audience and retain revisions.
        Dispatches run through consent-safe background jobs and delivery events.
      </p>
      <p>
        Eligible recipients must have newsletter consent, a verified email and
        optional email messages enabled. Preview checks current choices;
        delivery must check them again when sending is enabled.
      </p>
      <div className="operations-layout">
        <aside className="record-list">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              guard.proceed(() => {
                setForm(empty);
                setSavedForm(empty);
                setRevisions([]);
                setPreview(undefined);
                setMessage("");
              })
            }
          >
            New campaign
          </button>
          <form
            className="crm-filters"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                await refresh();
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Campaign state
              <select
                disabled={busy}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All drafts</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <button className="button secondary" disabled={busy}>
              Filter campaigns
            </button>
          </form>
          {campaigns.map((entry) => (
            <button
              disabled={busy}
              key={entry.id}
              aria-pressed={form.id === entry.id}
              onClick={() => guard.proceed(() => void open(entry.id!))}
            >
              <strong>{entry.name}</strong>
              <small>
                {entry.status === "archived" ? "Archived" : "Draft"} ·{" "}
                {entry.subject}
              </small>
            </button>
          ))}
          {!busy && !campaigns.length && (
            <p>No campaign drafts in this view.</p>
          )}
          {campaigns.length === 100 && (
            <p>Showing the latest 100 matching drafts.</p>
          )}
        </aside>
        <div>
          <div className="action-row">
            <h3>{form.id ? form.name : "New campaign draft"}</h3>
            {form.id && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => guard.proceed(() => void open(form.id!))}
              >
                Reload saved draft
              </button>
            )}
          </div>
          {form.status === "archived" && (
            <p className="notice">
              Archived draft. Restore to edit its content and audience.
            </p>
          )}
          <form
            className="member-settings"
            onSubmit={(e) => {
              e.preventDefault();
              void change("save");
            }}
          >
            <fieldset
              className="plain-fieldset"
              disabled={busy || form.status === "archived"}
            >
              <legend>Message and audience</legend>
              <label>
                Campaign name
                <input
                  required
                  minLength={3}
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                />
              </label>
              <label>
                Campaign subject
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  value={form.subject}
                  onChange={(e) => field("subject", e.target.value)}
                />
              </label>
              <label>
                Campaign message (plain text)
                <textarea
                  required
                  minLength={10}
                  maxLength={6000}
                  value={form.body}
                  onChange={(e) => field("body", e.target.value)}
                />
              </label>
              <div className="form-grid">
                <label>
                  Audience city (optional)
                  <input
                    maxLength={120}
                    value={form.audience.city}
                    onChange={(e) =>
                      field("audience", {
                        ...form.audience,
                        city: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Audience profession (optional)
                  <input
                    maxLength={120}
                    value={form.audience.profession}
                    onChange={(e) =>
                      field("audience", {
                        ...form.audience,
                        profession: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <p>
                Leave filters blank for all eligible accounts. City and
                profession match the full profile value, ignoring case. They do
                not establish professional eligibility or approved membership.
              </p>
              <button className="button">Save campaign draft</button>
            </fieldset>
          </form>
          <div className="action-row">
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage("");
                setPreview(undefined);
                try {
                  setPreview(
                    await api<Preview>("/api/staff/campaigns", {
                      action: "preview",
                      audience: form.audience,
                    }),
                  );
                } catch (error) {
                  setMessage((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Preview current audience
            </button>
            {form.id && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void change(
                    form.status === "archived" ? "restore" : "archive",
                  )
                }
              >
                {form.status === "archived" ? "Restore draft" : "Archive draft"}
              </button>
            )}
          </div>
          <details>
            <summary>Use a saved email template</summary>
            <p>
              Load the latest saved templates, then copy one into this draft.
              Changes to templates do not change a saved campaign.
            </p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage("");
                try {
                  const data = await api<{ templates: Template[] }>(
                    "/api/staff/communications",
                  );
                  setTemplates(data.templates);
                  setTemplateId("");
                  setMessage(
                    data.templates.length
                      ? "Saved templates loaded."
                      : "No saved templates yet.",
                  );
                } catch (error) {
                  setMessage((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Load saved templates
            </button>
            <label>
              Template to reuse
              <select
                value={templateId}
                disabled={busy || form.status === "archived"}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Select a template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button secondary"
              disabled={busy || !templateId || form.status === "archived"}
              onClick={() => {
                const template = templates.find(
                  (item) => item.id === templateId,
                );
                if (template) {
                  setForm({
                    ...form,
                    subject: template.subject,
                    body: template.body,
                  });
                  setPreview(undefined);
                  setMessage(
                    "Template copied into the editor. Save the draft to retain it.",
                  );
                }
              }}
            >
              Replace draft message with selected template
            </button>
          </details>
          <h3>Message preview</h3>
          <p>
            <strong>{form.subject || "Campaign subject preview"}</strong>
          </p>
          <p className="prose-text">
            {form.body || "Campaign message preview"}
          </p>
          {preview && (
            <section className="notice" aria-label="Audience preview">
              <h3>{preview.eligible} eligible recipients</h3>
              <p>
                Checked {new Date(preview.as_of).toLocaleString("en-IN")}. City:{" "}
                {preview.audience.city || "all"}; profession:{" "}
                {preview.audience.profession || "all"}. This preview is
                temporary and does not queue messages.
              </p>
              <p>
                {preview.matched} matching accounts; excluded:{" "}
                {preview.unsubscribed} without newsletter consent,{" "}
                {preview.unverified} opted-in accounts with unverified email,{" "}
                {preview.preference_blocked} verified subscribers with optional
                messages disabled.
              </p>
              {preview.sample.length ? (
                <>
                  <p>
                    First {preview.sample.length} eligible recipients (up to
                    20):
                  </p>
                  <ul>
                    {preview.sample.map((person) => (
                      <li key={person.email}>
                        {person.name} · {person.email}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>
                  No eligible recipients. Review filters and consent before
                  preparing delivery.
                </p>
              )}
            </section>
          )}
          {revisions.length > 0 && (
            <details>
              <summary>Saved revision history (latest 30)</summary>
              {revisions.map((revision) => (
                <details key={revision.version}>
                  <summary>
                    Revision {revision.version} · {revision.snapshot.status} ·{" "}
                    {revision.actor_name} ·{" "}
                    {new Date(revision.created_at).toLocaleString("en-IN")}
                  </summary>
                  <p>
                    <strong>
                      {revision.snapshot.name} · {revision.snapshot.subject}
                    </strong>
                  </p>
                  <p className="prose-text">{revision.snapshot.body}</p>
                  <p>
                    City: {revision.snapshot.audience.city || "all"};
                    profession: {revision.snapshot.audience.profession || "all"}
                    .
                  </p>
                </details>
              ))}
            </details>
          )}
          <CampaignDispatch
            key={form.id ?? "new"}
            id={form.id}
            version={form.version}
            dirty={dirty}
            archived={form.status === "archived"}
          />
          <p role="status" aria-live="polite">
            {message}
          </p>
        </div>
      </div>
      {guard.dialog}
    </section>
  );
}
