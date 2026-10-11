"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "./operations-client";
import { MemberImportJobProgress } from "./member-import-job-progress";
type Row = {
  name: string;
  email: string;
  error?: string;
  reason?: string;
  status?: string;
  fieldErrors?: Record<string, string>;
  normalizations?: unknown[];
  member?: unknown;
  match?: unknown;
  proposedChanges?: unknown;
  warnings?: string[];
  sourceRow?: number;
  membershipNumber?: string;
  diagnosticIssues?: {
    code: string;
    field: string;
    reason: string;
    severity: string;
  }[];
};
export function BulkOnboarding() {
  const [file, setFile] = useState<File | null>(null),
    [parentBatchId, setParentBatchId] = useState(""),
    [mode, setMode] = useState("existing-members"),
    [headers, setHeaders] = useState<string[]>([]),
    [fields, setFields] = useState<string[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState<{
      id: string;
      rows: Row[];
      committed_at?: string | null;
      mode?: string;
      version?: number;
    } | null>(null),
    [results, setResults] = useState<
      {
        email: string;
        status: string;
        reason?: string;
        emailStatus?: string;
        invitationStatus?: string;
        invitationId?: string;
      }[]
    >([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [batches, setBatches] = useState<
      { id: string; created_at: string; committed_at: string | null }[]
    >([]);
  const restore = useCallback(async (id: string) => {
    setBusy(true);
    try {
      const batch = await api<{
        id: string;
        rows: Row[];
        results: typeof results;
        committed_at: string | null;
        mode?: string;
        version?: number;
      }>("/api/staff/onboarding-import?id=" + id);
      setPreview({
        ...batch,
        mode: batch.mode === "existing-members" ? "members" : batch.mode,
      });
      setParentBatchId(
        batch.mode === "approved-accounts" ? '' : batch.id,
      );
      setMode(
        batch.mode === "approved-accounts"
          ? "approved-accounts"
          : ["members", "existing-members"].includes(batch.mode ?? "")
            ? "existing-members"
            : "invitation",
      );
      setResults(batch.results ?? []);
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
  }, []);
  useEffect(() => {
    api<{ batches: typeof batches }>("/api/staff/onboarding-import")
      .then((d) => {
        setBatches(d.batches);
        const id = new URLSearchParams(location.search).get("id");
        if (id) void restore(id);
      })
      .catch(() => setMessage("Unable to load batch history."));
  }, [restore]);
  async function read(mapped = false) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("mode", mode);
      if (mode === "existing-members" && (preview?.id || parentBatchId))
        form.set("parentBatchId", preview?.id ?? parentBatchId);
      if (mapped) form.set("mapping", JSON.stringify(mapping));
      const r = await fetch(
        mode === "existing-members"
          ? "/api/staff/member-import-jobs"
          : "/api/staff/onboarding-import",
        {
          method: "POST",
          body: form,
        },
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (mapped || mode === "existing-members") {
        setPreview({
          ...d,
          mode: d.mode === "existing-members" ? "members" : d.mode,
        });
        const savedUrl = new URL(location.href);
        savedUrl.searchParams.set("id", d.id);
        history.replaceState(null, "", savedUrl);
        setParentBatchId(d.id);
      } else {
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
  async function downloadCorrections() {
    if (!preview) return;
    try {
      const data = await api<{ headers: string[]; rows: string[][] }>(
        "/api/staff/member-import-jobs?correctionBatchId=" + preview.id,
      );
      const quote = (v: string, index: number) =>
        '"' +
        (/^[=+@]|^-\D/.test(v) &&
        !(data.headers[index] === "Mobile" && /^\+\d[\d ().-]*$/.test(v))
          ? "'" + v
          : v
        ).replaceAll('"', '""') +
        '"';
      const blob = new Blob(
          [
            [data.headers, ...data.rows]
              .map((row) => row.map(quote).join(","))
              .join("\r\n"),
          ],
          { type: "text/csv" },
        ),
        url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "member-corrections.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <section>
      <h2>Import members or accounts</h2>
      <label>
        Import mode
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setPreview(null);
            setHeaders([]);
            setResults([]);
          }}
        >
          {mode === "approved-accounts" && (
            <option value="approved-accounts" disabled>
              Approved account batch � invitations held
            </option>
          )}
          <option value="invitation">New accounts — invitations held</option>
          <option value="existing-members">
            Existing members — no invitations
          </option>
        </select>
      </label>
      <p>
        {mode === "existing-members"
          ? "Use the supplied 13-column member workbook. All ambiguous duplicate groups are held. No emails, passwords, paid status or verification are created."
          : "Create ordinary unverified accounts with invitations held. Review recipients and an approved template separately before sending."}
        Existing accounts are skipped. No passwords or verification badges can
        be imported.
      </p>
      <div className="action-row">
        <a
          href={`/api/staff/onboarding-import?template=csv&mode=${mode}`}
          download
        >
          CSV template
        </a>
        <a
          href={`/api/staff/onboarding-import?template=xlsx&mode=${mode}`}
          download
        >
          XLSX template
        </a>
      </div>
      <label>
        CSV/XLSX (5 MB, 1,000 users)
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => {
            if (preview?.mode === "members") setParentBatchId(preview.id);
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
        {mode === "existing-members"
          ? "Validate member workbook"
          : "Read columns"}
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
      {preview?.mode === "members" && (
        <>
          <button
            className="button secondary"
            onClick={() => void downloadCorrections()}
          >
            Download source correction template
          </button>
          <p>
            Keep this original preview open when uploading its corrected
            template. Source row numbers and original file hash must remain
            unchanged.
          </p>
          <MemberImportJobProgress
            key={preview.id}
            batchId={preview.id}
            version={preview.version ?? 1}
          />
        </>
      )}
      {preview && !preview.committed_at && (
        <>
          <ul>
            {preview.rows.map((r, i) => (
              <li key={i}>
                {r.sourceRow ? `Row ${r.sourceRow} · ` : ""}
                {r.name} · {r.email} · {r.membershipNumber} ·{" "}
                {r.status ?? "Preview"} ·{" "}
                {r.error ?? r.reason ?? "Ready to check at commit"}
                {r.warnings?.length ? " · " + r.warnings.join(" ") : ""}
                {r.fieldErrors && (
                  <ul>
                    {Object.entries(r.fieldErrors).map(([field, error]) => (
                      <li key={field}>
                        {field}: {error}
                      </li>
                    ))}
                  </ul>
                )}
                {!!r.diagnosticIssues?.length && (
                  <details>
                    <summary>All independently checked issues</summary>
                    <ul>
                      {r.diagnosticIssues.map((issue, index) => (
                        <li key={index}>
                          {issue.code} · {issue.field}: {issue.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {!!r.normalizations?.length && (
                  <details>
                    <summary>Recorded normalizations</summary>
                    <pre>{JSON.stringify(r.normalizations, null, 2)}</pre>
                  </details>
                )}
                {Boolean(r.member || r.match || r.proposedChanges) && (
                  <details>
                    <summary>
                      Validated fields and existing-record comparison
                    </summary>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {JSON.stringify(
                        {
                          member: r.member,
                          match: r.match,
                          proposedChanges: r.proposedChanges,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
          {preview.mode !== "members" && (
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    preview.mode === "approved-accounts"
                      ? "Create eligible accounts from this approved batch with invitations held, retaining incomplete addresses and holding conflicts?"
                      : preview.mode === "members"
                        ? "Import eligible members without emails, holding conflicts and preserving existing records?"
                        : `Create accounts with invitations held for exactly ${preview.rows.filter((r) => !r.error).length} eligible records? Existing accounts will be skipped.`,
                  )
                )
                  return;
                setBusy(true);
                try {
                  let d: {
                    results: typeof results;
                    complete?: boolean;
                    processed?: number;
                    total?: number;
                  };
                  do {
                    d = await api<{
                      results: typeof results;
                      complete?: boolean;
                      processed?: number;
                      total?: number;
                    }>("/api/staff/onboarding-import", {
                      action: "commit",
                      id: preview.id,
                      version: preview.version,
                    });
                    setResults(d.results);
                    setMessage(
                      `Processed ${d.processed ?? d.results.length} of ${d.total ?? preview.rows.length} rows. Results saved; this batch can be resumed.`,
                    );
                  } while (d.complete === false);
                  setPreview({
                    ...preview,
                    committed_at: new Date().toISOString(),
                  });
                  setMessage(
                    preview.mode === "approved-accounts"
                      ? "Accounts created with invitation delivery held. Review every row outcome."
                      : preview.mode === "members"
                        ? "Member import committed without invitations. Review every row outcome."
                        : "Accounts created with invitations held. Configure the template and review recipients in the member register.",
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
          )}
        </>
      )}
      <ul>
        {busy && preview && (
          <li>
            <progress
              aria-label="Import progress"
              max={preview.rows.length}
              value={results.length}
            />
            <span>
              {" "}
              {results.length} of {preview.rows.length} records saved
            </span>
          </li>
        )}
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
      {preview?.committed_at &&
        results.some((r) => ["failed", "conflict"].includes(r.status)) && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const d = await api<{
                  id: string;
                  version: number;
                  mode: string;
                  rows: Row[];
                }>("/api/staff/onboarding-import", {
                  action: "retry",
                  id: preview.id,
                });
                setPreview(d);
                setResults([]);
                setMessage(
                  "Failed rows previewed again. Correct invalid source values in a new upload before committing.",
                );
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Review / retry failed records
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
