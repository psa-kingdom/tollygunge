"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
type Source = {
  id: string;
  name: string;
  url: string;
  type: string;
  notes: string;
  status: string;
  version: number;
  updated_at: string;
};
type Revision = {
  version: number;
  action: string;
  created_at: string;
  actor_name: string;
  snapshot: Source;
};
const blank = { name: "", url: "", type: "website", notes: "" };
export function NewsSources() {
  const [sources, setSources] = useState<Source[]>([]),
    [entry, setEntry] = useState<Source>(),
    [form, setForm] = useState(blank),
    [revisions, setRevisions] = useState<Revision[]>([]),
    [admin, setAdmin] = useState(false),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState("Loading sources…");
  const dirty =
    JSON.stringify(form) !==
    JSON.stringify(
      entry
        ? {
            name: entry.name,
            url: entry.url,
            type: entry.type,
            notes: entry.notes,
          }
        : blank,
    );
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    const navigate = (e: MouseEvent) => {
      const link = (e.target as Element).closest("a");
      if (
        dirty &&
        link &&
        link.target !== "_blank" &&
        !confirm("Discard unsaved source changes?")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", prevent);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", prevent);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  async function load(id?: string) {
    const data = await api<{
      sources: Source[];
      revisions: Revision[];
      administrator: boolean;
    }>(`/api/staff/news-sources${id ? `?id=${id}` : ""}`);
    setSources(data.sources);
    setRevisions(data.revisions);
    setAdmin(data.administrator);
  }
  useEffect(() => {
    let active = true;
    api<{ sources: Source[]; administrator: boolean }>(
      "/api/staff/news-sources",
    )
      .then((data) => {
        if (active) {
          setSources(data.sources);
          const id = new URLSearchParams(location.search).get("source");
          const chosen = data.sources.find((s) => s.id === id);
          if (chosen) {
            setEntry(chosen);
            setForm({
              name: chosen.name,
              url: chosen.url,
              type: chosen.type,
              notes: chosen.notes,
            });
            void api<{ revisions: Revision[] }>(
              "/api/staff/news-sources?id=" + encodeURIComponent(chosen.id),
            )
              .then((v) => {
                if (active) setRevisions(v.revisions);
              })
              .catch((e) => {
                if (active) setMessage(e.message);
              });
          }
          setAdmin(data.administrator);
          setMessage("");
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function choose(source?: Source) {
    if (dirty && !confirm("Discard unsaved source changes?")) return;
    setBusy(true);
    try {
      await load(source?.id);
      setEntry(source);
      setForm(
        source
          ? {
              name: source.name,
              url: source.url,
              type: source.type,
              notes: source.notes,
            }
          : blank,
      );
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function act(action: string) {
    setBusy(true);
    try {
      const data = await api<{ source: Source }>("/api/staff/news-sources", {
        action,
        ...form,
        ...(entry ? { id: entry.id } : {}),
        version: entry?.version ?? 0,
      });
      setEntry(data.source);
      setForm({
        name: data.source.name,
        url: data.source.url,
        type: data.source.type,
        notes: data.source.notes,
      });
      await load(data.source.id);
      setMessage(
        action === "save"
          ? "Source saved as draft. Approval does not start collection."
          : `Source ${data.source.status}. Collection remains disabled.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="notice">
        Sources prepare future editorial collection. Approval does not fetch
        feeds, schedule jobs or publish news. Approved sources return to draft
        when edited.
      </p>
      <div className="action-row">
        <h2>Source catalogue</h2>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void choose()}
        >
          New source
        </button>
      </div>
      {!sources.length && (
        <p>No sources yet. Add an editorial source for administrator review.</p>
      )}
      <div className="action-row">
        {sources.map((source) => (
          <button
            className="button secondary"
            key={source.id}
            disabled={busy}
            onClick={() => void choose(source)}
            aria-pressed={entry?.id === source.id}
          >
            {source.name} · {source.status}
          </button>
        ))}
      </div>
      <form
        className="member-settings"
        onSubmit={(e) => {
          e.preventDefault();
          void act("save");
        }}
      >
        <fieldset className="plain-fieldset" disabled={busy}>
          <legend>{entry ? "Edit source" : "New source draft"}</legend>
          <label>
            Source name · {form.name.length}/160
            <input
              required
              maxLength={160}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            HTTPS URL · {form.url.length}/1,000
            <input
              type="url"
              required
              maxLength={1000}
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          </label>
          <label>
            Source type
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="website">Website</option>
              <option value="rss">RSS</option>
            </select>
          </label>
          <label>
            Editorial notes · {form.notes.length}/3,000
            <textarea
              rows={5}
              maxLength={3000}
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </label>
          <p>
            {entry
              ? `Saved status: ${entry.status} · version ${entry.version}`
              : "Private draft"}
            {dirty ? " · Unsaved changes" : ""}
          </p>
          <div className="action-row">
            <button className="button" type="submit" disabled={!dirty}>
              Save draft
            </button>
            {admin && (
              <>
                <button
                  className="button secondary"
                  type="button"
                  disabled={dirty || entry?.status !== "draft"}
                  onClick={() => void act("approve")}
                >
                  Approve source
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={dirty || entry?.status !== "approved"}
                  onClick={() => void act("pause")}
                >
                  Pause source
                </button>
              </>
            )}
          </div>
        </fieldset>
      </form>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!!revisions.length && (
        <section className="content-section">
          <h2>Review history</h2>
          {revisions.map((r) => (
            <details key={r.version}>
              <summary>
                Version {r.version} · {r.action} · {r.actor_name} ·{" "}
                {new Date(r.created_at).toLocaleString()}
              </summary>
              <p>
                {r.snapshot.name} · {r.snapshot.type} · {r.snapshot.status}
              </p>
              <p>{r.snapshot.url}</p>
              <p>{r.snapshot.notes || "No notes."}</p>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
