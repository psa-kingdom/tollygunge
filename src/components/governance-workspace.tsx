"use client";
import { useState, useEffect } from "react";
import { api } from "./operations-client";
import type { GovernanceProfile } from "@/domain/governance";
type Entry = {
  id: string;
  draft: GovernanceProfile;
  published: GovernanceProfile | null;
  version: number;
  history?: { version: number; action: string; created_at: string }[];
};
type Data = { records: Entry[]; portraits: { id: string; title: string }[] };
const empty: GovernanceProfile = {
  name: "",
  role: "",
  group: "executive",
  committee: "",
  profession: "",
  biography: "",
  term: "",
  order: 0,
  portraitId: null,
};
export function GovernanceWorkspace() {
  const [data, setData] = useState<Data>({ records: [], portraits: [] }),
    [selected, setSelected] = useState<Entry | null>(null),
    [body, setBody] = useState(empty),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState("Loading association profiles…");
  useEffect(() => {
    api<Data>("/api/staff/governance")
      .then((value) => {
        setData(value);
        setReady(true);
        setMessage("");
      })
      .catch((e) => setMessage(e.message));
  }, []);
  const dirty =
    JSON.stringify(body) !== JSON.stringify(selected?.draft ?? empty);
  function select(entry: Entry | null) {
    if (dirty && !window.confirm("Discard unsaved profile edits?")) return;
    setSelected(entry);
    setBody(entry?.draft ?? empty);
    setConfirmed(false);
    setMessage("");
  }
  async function act(action: string) {
    setBusy(true);
    try {
      const row = await api<Entry>("/api/staff/governance", {
        action,
        id: selected?.id,
        version: selected?.version ?? 0,
        body,
        confirmPublication: confirmed,
      });
      const refreshed = await api<Data>("/api/staff/governance");
      setData(refreshed);
      setSelected(refreshed.records.find((r) => r.id === row.id) ?? row);
      setBody(row.draft);
      setConfirmed(false);
      setMessage(
        action === "save"
          ? "Draft saved. Existing publication is unchanged."
          : action === "publish"
            ? "Profile published on the association website."
            : "Public profile withdrawn; history retained.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  function field<K extends keyof GovernanceProfile>(
    key: K,
    value: GovernanceProfile[K],
  ) {
    setBody((current) => ({ ...current, [key]: value }));
    setConfirmed(false);
  }
  return (
    <>
      <p>
        Manage executive, sub-committee and founding-member profiles. These
        public association records do not grant staff access or activate
        membership.
      </p>
      <div className="operations-layout">
        <aside className="record-list">
          <button
            className="button secondary"
            disabled={busy || !ready}
            onClick={() => select(null)}
          >
            New association profile
          </button>
          {data.records.length === 0 && ready && (
            <p>No association profiles saved.</p>
          )}
          {data.records.map((entry) => (
            <button
              type="button"
              disabled={busy}
              key={entry.id}
              className={entry.id === selected?.id ? "selected" : ""}
              onClick={() => select(entry)}
            >
              <strong>{entry.draft.name}</strong>
              <small>
                {entry.draft.role} · {entry.published ? "Published" : "Draft"}
              </small>
            </button>
          ))}
        </aside>
        <section>
          <h2>
            {selected
              ? body.name || "Association profile"
              : "New association profile"}
          </h2>
          <form
            className="member-settings"
            onSubmit={(event) => {
              event.preventDefault();
              void act("save");
            }}
          >
            <fieldset disabled={busy || !ready} className="plain-fieldset">
              <div className="form-grid">
                <label>
                  Full name
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={body.name}
                    onChange={(e) => field("name", e.target.value)}
                  />
                </label>
                <label>
                  Association role
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={body.role}
                    onChange={(e) => field("role", e.target.value)}
                  />
                </label>
                <label>
                  Profile group
                  <select
                    value={body.group}
                    onChange={(e) =>
                      field(
                        "group",
                        e.target.value as GovernanceProfile["group"],
                      )
                    }
                  >
                    <option value="executive">Executive Committee</option>
                    <option value="subcommittee">Sub-Committee</option>
                    <option value="founding">Founding Member</option>
                  </select>
                </label>
                <label>
                  Committee name
                  <input
                    required={body.group === "subcommittee"}
                    maxLength={120}
                    value={body.committee}
                    onChange={(e) => field("committee", e.target.value)}
                  />
                </label>
                <label>
                  Professional title (optional)
                  <input
                    maxLength={160}
                    value={body.profession}
                    onChange={(e) => field("profession", e.target.value)}
                  />
                </label>
                <label>
                  Term / year (optional)
                  <input
                    maxLength={80}
                    value={body.term}
                    onChange={(e) => field("term", e.target.value)}
                  />
                </label>
                <label>
                  Display order
                  <input
                    type="number"
                    required
                    min={0}
                    max={999}
                    value={body.order}
                    onChange={(e) => field("order", Number(e.target.value))}
                  />
                </label>
                <label>
                  Published editorial portrait (optional)
                  <select
                    value={body.portraitId ?? ""}
                    onChange={(e) =>
                      field("portraitId", e.target.value || null)
                    }
                  >
                    <option value="">No portrait</option>
                    {data.portraits.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                    {body.portraitId &&
                      !data.portraits.some((p) => p.id === body.portraitId) && (
                        <option value={body.portraitId}>
                          Portrait no longer published — choose another
                        </option>
                      )}
                  </select>
                </label>
              </div>
              <label>
                Professional biography (optional)
                <textarea
                  maxLength={1200}
                  rows={4}
                  value={body.biography}
                  onChange={(e) => field("biography", e.target.value)}
                />
              </label>
              <button className="button">Save profile draft</button>
            </fieldset>
          </form>
          {selected && (
            <>
              <p>
                Version {selected.version} ·{" "}
                {selected.published
                  ? "Published snapshot retained"
                  : "Not published"}
                {dirty ? " · Unsaved edits" : ""}
              </p>
              <label className="consent-row">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={busy || dirty}
                />
                I confirm these association details and permission to publish
                the profile and portrait.
              </label>
              <div className="action-row">
                <button
                  className="button"
                  disabled={busy || dirty || !confirmed}
                  onClick={() => void act("publish")}
                >
                  Publish saved profile
                </button>
                <button
                  className="button secondary"
                  disabled={busy || dirty || !selected.published}
                  onClick={() => void act("unpublish")}
                >
                  Withdraw public profile
                </button>
              </div>
              {selected.published && (
                <div className="notice">
                  <strong>
                    Currently published: {selected.published.name}
                  </strong>
                  <p>
                    {selected.published.role} · {selected.published.profession}
                  </p>
                </div>
              )}
              <details>
                <summary>
                  Saved history ({selected.history?.length ?? 0})
                </summary>
                {selected.history?.map((h) => (
                  <p key={h.version}>
                    Version {h.version} · {h.action} ·{" "}
                    {new Date(h.created_at).toLocaleString("en-IN")}
                  </p>
                ))}
              </details>
            </>
          )}
          <p role="status">{message}</p>
        </section>
      </div>
    </>
  );
}
