"use client";
import { CopyValue } from "./portal-values";
import { WorkspacePanel, WorkspaceSteps, WorkspaceEmptyState } from "./workspace-ui";
import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "./operations-client";
import { InvitationReleaseReview } from "./invitation-release-review";
import { MemberImportJobProgress } from "./member-import-job-progress";
type Row = {
  name: string;
  email: string;
  details?: Record<string, string>;
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
  source?: Record<string, string>;
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
    [preview, setPreview] = useState<{
      id: string;
      rows: Row[];
      committed_at?: string | null;
      invitationReviewId?: string;
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
    [busy, setBusy] = useState(false);
  const restore = useCallback(async (id: string) => {
    setBusy(true);
    try {
      const batch = await api<{
        id: string;
        rows: Row[];
        results: typeof results;
        committed_at: string | null;
        invitationReviewId?: string;
        mode?: string;
        version?: number;
      }>("/api/staff/onboarding-import?id=" + id);
      setPreview({
        ...batch,
        mode: batch.mode === "existing-members" ? "members" : batch.mode,
      });
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
    const id = new URLSearchParams(location.search).get("id");
    if (id) void Promise.resolve().then(() => restore(id));
  }, [restore]);
  async function read() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("mode", "invitation");
      const r = await fetch(
        "/api/staff/onboarding-import",
        {
          method: "POST",
          body: form,
        },
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setPreview({ ...d, mode: d.mode === "existing-members" ? "members" : d.mode });
      const savedUrl = new URL(location.href);
      savedUrl.searchParams.set("id", d.id);
      history.replaceState(null, "", savedUrl);
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
  const workbookInput = useRef<HTMLInputElement>(null);
  const accountImport = preview?.mode !== "members" && preview?.mode !== "approved-accounts";
  const invitationStep = Boolean(preview?.committed_at && accountImport);
  const heldResults = results.filter((row) => row.status === "created" && row.invitationStatus === "held");
  const namesByEmail = new Map(preview?.rows.map((row) => [row.email, row.name]));
  return (
    <section className="bulk-onboarding-workspace">
      <WorkspaceSteps
        steps={["Choose workbook", "Review records", "Create accounts", "Review & send invitations"]}
        current={invitationStep ? 3 : preview?.committed_at || (busy && results.length) ? 2 : preview ? 1 : 0}
      />
      <div className="workspace-import-layout">
      <WorkspacePanel title="Prepare your import" description="Download the template and upload your completed workbook." id="bulk-import-upload">
      <p>Use the member workbook to include names, membership numbers, contact details and addresses. Name and email are required. The import creates Free accounts and holds invitations for staff review.</p>
      <div className="action-row workspace-template-actions">
        <a className="button secondary"
          href="/api/staff/onboarding-import?template=csv&mode=invitation"
          download
        >
          CSV template
        </a>
        <a className="button secondary"
          href="/api/staff/onboarding-import?template=xlsx&mode=invitation"
          download
        >
          XLSX template
        </a>
      </div>
      <label className="workspace-upload-field">
        CSV/XLSX (5 MB, 1,000 users)
        <input
          ref={workbookInput}
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setResults([]);
          }}
        />
      </label>
      <button
        className="button"
        disabled={busy || !file}
        onClick={() => void read()}
      >
        Preview uploaded records
      </button>
      </WorkspacePanel>
      <WorkspacePanel title="Before you begin" className="workspace-help-panel"><ul className="workspace-guidance-list"><li><strong>Start with the right template</strong><span>Keep the 13 column headers from the supplied member workbook.</span></li><li><strong>Validate before committing</strong><span>Review matched identities, duplicates and corrections before importing.</span></li><li><strong>Review invitations separately</strong><span>New account invitations remain held until recipients and the email are approved.</span></li></ul></WorkspacePanel>
      </div>
      <div className="workspace-import-review" hidden={!preview && !results.length}>
      {preview && (
        <>
          <div className="import-preview-heading">
            <div>
              <h2 id="import-preview-title">Uploaded records</h2>
              <p>{preview.rows.length.toLocaleString()} {preview.rows.length === 1 ? "row" : "rows"} found</p>
            </div>
            {preview.mode === "members" && (
              <button className="button secondary" onClick={() => void downloadCorrections()}>
                Download source correction template
              </button>
            )}
          </div>
          {preview.rows.length > 0 && (
            <div className="table-scroll import-preview-scroll" role="region" aria-labelledby="import-preview-title" tabIndex={0}>
              <table className="import-preview-table">
                <thead>
                  <tr>
                    <th scope="col">Row</th>
                    <th scope="col">Member</th>
                    <th scope="col">Membership no.</th>
                    <th scope="col">Uploaded fields</th>
                    <th scope="col">Status</th>
                    <th scope="col">Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, index) => {
                    const uploadedFields = Object.entries(row.source ?? row.details ?? {})
                      .filter(([, value]) => value.trim());
                    const membershipNumber = row.membershipNumber || row.details?.membershipNumber || row.source?.["Membership No."];
                    const hasDetails = Boolean(
                      row.fieldErrors || row.diagnosticIssues?.length ||
                      row.normalizations?.length || row.member || row.match || row.proposedChanges,
                    );
                    const sourceName = [row.source?.["First Name"], row.source?.["Last Name"]]
                      .filter(Boolean).join(" ").trim();
                    const existingAccount = row.error?.startsWith("Existing account")
                      || row.reason === "Existing account";
                    const status = existingAccount ? "Will be skipped"
                      : row.status === "created" ? "Ready to import"
                      : row.status === "failed" || row.error ? "Needs correction"
                      : row.status ?? "Ready to import";
                    return (
                      <tr key={row.sourceRow ?? index}>
                        <td>{row.sourceRow ?? index + 1}</td>
                        <th scope="row">
                          {row.name || sourceName || "Name missing"}
                          {row.email && <span className="import-preview-email">{row.email}</span>}
                        </th>
                        <td>{membershipNumber || "Not supplied"}</td>
                        <td>
                          {uploadedFields.length > 0 && (
                            <details className="import-fields-disclosure">
                              <summary>View uploaded fields</summary>
                              <dl className="import-uploaded-fields">
                                {uploadedFields.map(([field, value]) => (
                                  <div key={field}><dt>{field}</dt><dd>{value}</dd></div>
                                ))}
                              </dl>
                            </details>
                          )}
                        </td>
                        <td><span className="import-preview-status">{status}</span></td>
                        <td>
                          {row.error ?? row.reason ?? "—"}
                          {row.warnings?.map((warning, index) => <p key={index}>{warning}</p>)}
                          {hasDetails && (
                            <details>
                              <summary>Validation details</summary>
                              {Object.entries(row.fieldErrors ?? {}).map(([field, error]) => (
                                <p key={field}><strong>{field}</strong> {error}</p>
                              ))}
                              {row.diagnosticIssues?.map((issue, index) => (
                                <p key={index}><strong>{issue.field}</strong> {issue.reason}</p>
                              ))}
                              {!!row.normalizations?.length && (
                                <details>
                                  <summary>Recorded normalizations</summary>
                                  <pre>{JSON.stringify(row.normalizations, null, 2)}</pre>
                                </details>
                              )}
                              {Boolean(row.member || row.match || row.proposedChanges) && (
                                <details>
                                  <summary>Existing-record comparison</summary>
                                  <pre>{JSON.stringify({
                                    member: row.member,
                                    match: row.match,
                                    proposedChanges: row.proposedChanges,
                                  }, null, 2)}</pre>
                                </details>
                              )}
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {preview.mode === "members" && (
            <details className="import-correction-help">
              <summary>How to upload corrections</summary>
              <p>Keep the original source row numbers and file hash when preparing corrections.</p>
            </details>
          )}
          <div className="import-preview-actions">
          {preview.mode !== "members" && !preview.committed_at && (
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
                        : "Accounts created with invitations held. Review this batch before sending.",
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
          {preview.mode !== "members" && (
            <button className="button secondary" disabled={busy} onClick={() => void restore(preview.id)}>
              Refresh batch and email status
            </button>
          )}
          </div>
        </>
      )}
      {preview?.mode === "members" && (
        <div className="import-preview-footer">
          <MemberImportJobProgress key={preview.id} batchId={preview.id} version={preview.version ?? 1} />
        </div>
      )}
      {invitationStep && preview && (
        <div className="import-preview-footer">
          <h2>Review &amp; send invitations</h2>
          {heldResults.length > 0 || preview.invitationReviewId ? (
            <InvitationReleaseReview
              key={preview.id}
              batchId={preview.id}
              savedReviewId={preview.invitationReviewId}
              canManage={true}
              pendingRecipients={heldResults.map((row) => ({
                email: row.email,
                name: namesByEmail.get(row.email) || row.email,
                status: row.emailStatus ?? "held",
              }))}
              onComplete={() => void restore(preview.id)}
            />
          ) : <p>No invitations are on hold for this batch.</p>}
        </div>
      )}
      {invitationStep && results.some((row) => row.status !== "created") && <h3>Rows excluded from the import</h3>}
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
        {(invitationStep ? results.filter((row) => row.status !== "created") : results).map((r, i) => (
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
      {preview?.mode === "members" && results.length > 0 && (
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
      </div>
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
    <div className="email-settings-workspace">
      <WorkspacePanel id="email-test-recipients" title="Approved test recipients">
      <p>
        Delivery configuration:{" "}
        {data === null ? "Loading setup…" : data.configured
          ? "Configured; mailbox acceptance remains separate"
          : "Provider setup required"}
        . Test messages use harmless login links; normal user messages keep
        their own recipients.
      </p>
      <div className="email-settings-controls">
      <label>
        Controlled inboxes (one per line)
        <textarea
          rows={4}
          placeholder="name@example.com"
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
      </div>
      </WorkspacePanel>
      <WorkspacePanel title="Send a test message" description="Select the transactional template to test with an approved recipient.">
      <div className="email-settings-controls">
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
      <div className="email-test-recipient-list">
      {data?.settings.test_recipients.map((r) => (
        <div className="email-test-recipient" key={r}>
        <CopyValue value={r} />
        <button
          aria-label={`Send test to ${r}`}
          className="button secondary"
          onClick={() => void run({ action: "test", recipient: r, kind })}
        >
          Send test
        </button>
        </div>
      ))}
      </div>
      </div>
      {data && !data.settings.test_recipients.length && <WorkspaceEmptyState compact icon="mail" title="Add a test recipient first" description="Save an approved email address above before sending a template test." actionLabel="Add test recipients" href="#email-test-recipients" />}
      </WorkspacePanel>
      <WorkspacePanel title="Transactional delivery history">
      {data && !data.mail.length && <WorkspaceEmptyState compact icon="mail" title="No transactional deliveries yet" description="Queued invitations and template tests will appear here with their delivery status." />}
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
      </WorkspacePanel>
      <p role="status">{message}</p>
    </div>
  );
}
