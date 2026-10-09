"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
type Row = { name: string; email: string; error?: string };
export function BulkOnboarding() {
  const [file, setFile] = useState<File | null>(null),
    [headers, setHeaders] = useState<string[]>([]),
    [fields, setFields] = useState<string[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState<{
      id: string;
      rows: Row[];
      committed_at?: string | null;
    } | null>(null),
    [results, setResults] = useState<
      {
        email: string;
        status: string;
        reason?: string;
        emailStatus?: string;
        invitationId?: string;
      }[]
    >([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [batches, setBatches] = useState<
      { id: string; created_at: string; committed_at: string | null }[]
    >([]);
  useEffect(() => {
    api<{ batches: typeof batches }>("/api/staff/onboarding-import")
      .then((d) => setBatches(d.batches))
      .catch(() => setMessage("Unable to load batch history."));
  }, []);
  async function restore(id: string) {
    setBusy(true);
    try {
      const batch = await api<{
        id: string;
        rows: Row[];
        results: typeof results;
        committed_at: string | null;
      }>("/api/staff/onboarding-import?id=" + id);
      setPreview(batch);
      setResults(batch.results);
      setMessage(
        batch.committed_at
          ? "Saved batch and current invitation status restored."
          : "Saved preview restored. Review before committing.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function read(mapped = false) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (mapped) form.set("mapping", JSON.stringify(mapping));
      const r = await fetch("/api/staff/onboarding-import", {
        method: "POST",
        body: form,
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (mapped) setPreview(d);
      else {
        setHeaders(d.headers);
        setFields(d.fields);
        setMapping(
          Object.fromEntries(
            d.fields
              .filter((x: string) => d.headers.includes(x))
              .map((x: string) => [x, x]),
          ),
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Import accounts</h2>
      <p>
        Create ordinary unverified accounts and send password-setup invitations.
        Existing accounts are skipped. No passwords or verification badges can
        be imported.
      </p>
      <div className="action-row">
        <a href="/api/staff/onboarding-import?template=csv" download>
          CSV template
        </a>
        <a href="/api/staff/onboarding-import?template=xlsx" download>
          XLSX template
        </a>
      </div>
      <label>
        CSV/XLSX (5 MB, 1,000 users)
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setHeaders([]);
            setResults([]);
          }}
        />
      </label>
      <button
        className="button secondary"
        disabled={busy || !file}
        onClick={() => void read()}
      >
        Read columns
      </button>
      {headers.length > 0 && (
        <>
          <div className="form-grid">
            {fields.map((f) => (
              <label key={f}>
                {f}
                {["name", "email"].includes(f) ? " *" : ""}
                <select
                  value={mapping[f] ?? ""}
                  onChange={(e) => {
                    const next = { ...mapping };
                    if (e.target.value) next[f] = e.target.value;
                    else delete next[f];
                    setMapping(next);
                    setPreview(null);
                  }}
                >
                  <option value="">Do not import</option>
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            className="button"
            disabled={busy || !mapping.name || !mapping.email}
            onClick={() => void read(true)}
          >
            Validate preview
          </button>
        </>
      )}
      {preview && !preview.committed_at && (
        <>
          <ul>
            {preview.rows.map((r, i) => (
              <li key={i}>
                {r.name} · {r.email} · {r.error ?? "Ready to create"}
              </li>
            ))}
          </ul>
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              if (
                !confirm(
                  "Create the valid new accounts and queue their invitation emails?",
                )
              )
                return;
              setBusy(true);
              try {
                const d = await api<{ results: typeof results }>(
                  "/api/staff/onboarding-import",
                  { action: "commit", id: preview.id },
                );
                setResults(d.results);
                setPreview({
                  ...preview,
                  committed_at: new Date().toISOString(),
                });
                setMessage(
                  "Import committed. Check Email settings for delivery status.",
                );
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Commit failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirm import
          </button>
        </>
      )}
      <ul>
        {results.map((r, i) => (
          <li key={i}>
            {r.email}: {r.status} {r.reason}{" "}
            {r.emailStatus ? " · Email: " + r.emailStatus : ""}
            {r.invitationId && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={async () => {
                  if (
                    !confirm(
                      "Issue a new password-setup invitation? Any unused previous link will stop working.",
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await api("/api/staff/onboarding-import", {
                      action: "reissue",
                      id: r.invitationId,
                    });
                    if (preview) await restore(preview.id);
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Reissue invitation
              </button>
            )}
            {r.invitationId && r.emailStatus === "failed" && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("/api/staff/onboarding-import", {
                      action: "retry",
                      id: r.invitationId,
                    });
                    if (preview) await restore(preview.id);
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Retry failed invitation
              </button>
            )}
          </li>
        ))}
      </ul>
      {preview && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void restore(preview.id)}
        >
          Refresh batch and email status
        </button>
      )}
      <h3>Recent batches</h3>
      {batches.map((batch) => (
        <p key={batch.id}>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void restore(batch.id)}
          >
            {new Date(batch.created_at).toLocaleString("en-IN")} ·{" "}
            {batch.committed_at ? "Committed" : "Preview"}
          </button>
        </p>
      ))}
      <p role="status">{message}</p>
    </section>
  );
}
type Settings = {
  settings: { version: number; test_recipients: string[] };
  configured: boolean;
  mail: {
    id: string;
    recipient: string;
    kind: string;
    status: string;
    attempts: number;
  }[];
};
export function OnboardingEmailSettings() {
  const [data, setData] = useState<Settings | null>(null),
    [recipients, setRecipients] = useState(""),
    [message, setMessage] = useState(""),
    [kind, setKind] = useState("welcome");
  async function load() {
    const d = await api<Settings>("/api/staff/onboarding-email");
    setData(d);
    setRecipients(d.settings.test_recipients.join("\n"));
  }
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch(() => setMessage("Unable to load email settings."));
  }, []);
  async function run(body: unknown, path = "/api/staff/onboarding-email") {
    try {
      await api(path, body);
      await load();
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed.");
    }
  }
  return (
    <>
      <h2>Test recipients</h2>
      <p>
        Delivery configuration:{" "}
        {data?.configured
          ? "Configured; mailbox acceptance remains separate"
          : "Provider setup required"}
        . Test messages use harmless login links; normal user messages keep
        their own recipients.
      </p>
      <label>
        Controlled inboxes (one per line)
        <textarea
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
        />
      </label>
      <button
        className="button"
        onClick={() =>
          void run({
            recipients: recipients
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean),
            version: data?.settings.version,
          })
        }
      >
        Save recipients
      </button>
      <label>
        Test template
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {["welcome", "verification", "recovery", "invitation", "update"].map(
            (x) => (
              <option key={x}>{x}</option>
            ),
          )}
        </select>
      </label>
      {data?.settings.test_recipients.map((r) => (
        <button
          key={r}
          className="button secondary"
          onClick={() => void run({ action: "test", recipient: r, kind })}
        >
          Send test to {r}
        </button>
      ))}
      <h2>Transactional delivery history</h2>
      <button className="button secondary" onClick={() => void load()}>
        Refresh status
      </button>
      {data?.mail.map((m) => (
        <article className="notice" key={m.id}>
          <p>
            {m.recipient} · {m.kind} · {m.status} · attempts {m.attempts}
          </p>
          {m.kind === "invitation" && (
            <>
              <button
                className="button secondary"
                disabled={!["failed", "queued"].includes(m.status)}
                onClick={() =>
                  void run(
                    { action: "retry", id: m.id },
                    "/api/staff/onboarding-import",
                  )
                }
              >
                Retry failed invitation
              </button>
              <button
                className="button secondary"
                onClick={() =>
                  void run(
                    { action: "reissue", id: m.id },
                    "/api/staff/onboarding-import",
                  )
                }
              >
                Reissue setup link
              </button>
            </>
          )}
        </article>
      ))}
      <p role="status">{message}</p>
    </>
  );
}
