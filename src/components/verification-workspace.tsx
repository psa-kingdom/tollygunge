"use client";
import { useEffect, useState } from "react";
import { useEmailEditGuard } from "./email-edit-guard";
import { api } from "./operations-client";
import {
  verificationSteps,
  type VerificationField,
} from "@/domain/verification";
type Review = {
  id: string;
  person_id: string;
  version: number;
  name: string;
  email: string;
  status: string;
  reason: string;
  requirement_version: number;
  snapshot: { details: Record<string, string> };
  accepted_verified: boolean;
  requirement_fields: VerificationField[];
};
type Data = {
  admin: boolean;
  page: number;
  hasMore: boolean;
  policy: { version: number; fields: VerificationField[] };
  draft: { version: number; fields: VerificationField[] } | null;
  reviews: Review[];
  verified: {
    id: string;
    version: number;
    name: string;
    email: string;
    verification_version: number | null;
    verification_update_requested: boolean;
  }[];
  history: { action: string; entity_id: string; created_at: string }[];
};
export function VerificationWorkspace() {
  const [data, setData] = useState<Data | null>(null),
    [fields, setFields] = useState<VerificationField[]>([]),
    [version, setVersion] = useState(0),
    [tab, setTab] = useState("Review queue"),
    [message, setMessage] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [impact, setImpact] = useState<number | null>(null);
  const guard = useEmailEditGuard(dirty);
  async function load(page = 1) {
    const d = await api<Data>("/api/staff/verification?page=" + page);
    setData(d);
    setFields(d.draft?.fields ?? d.policy.fields);
    setVersion(d.draft?.version ?? 0);
    setDirty(false);
    setImpact(null);
  }
  useEffect(() => {
    void Promise.resolve()
      .then(() => load())
      .catch(() => setMessage("Unable to load verification workspace."));
  }, []);
  async function action(body: unknown) {
    setBusy(true);
    try {
      await api("/api/staff/verification", body);
      await load();
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  function edit(index: number, patch: Partial<VerificationField>) {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
    setDirty(true);
    setImpact(null);
  }
  return (
    <>
      {guard.dialog}
      <p className="notice">
        A Verified profile is independent from email verification, paid
        membership and public publication. Publishing requirements preserves
        existing badges.
      </p>
      <div role="tablist" className="action-row">
        {["Review queue", "Requirements", "History"].map((t) => (
          <button
            role="tab"
            key={t}
            aria-selected={tab === t}
            className="button secondary"
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <p role="status">{message}</p>
      {tab === "Review queue" && (
        <>
          <label>
            Decision reason
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
            />
          </label>
          {data?.reviews.map((r) => (
            <article className="notice" key={r.id}>
              <h2>{r.name}</h2>
              <p>
                {r.email} · {r.status} · Requirements v{r.requirement_version}
                {r.accepted_verified ? " · Existing badge retained" : ""}
              </p>
              <details>
                <summary>Submitted details and evidence</summary>
                <dl>
                  {Object.entries(r.snapshot.details).map(([id, value]) => (
                    <div key={id}>
                      <dt>
                        {r.requirement_fields.find((f) => f.id === id)?.label ??
                          id}
                      </dt>
                      <dd>
                        {r.requirement_fields.find((f) => f.id === id)?.type ===
                        "document" ? (
                          <a
                            href={"/api/documents/" + value}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View private evidence
                          </a>
                        ) : (
                          value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
              <p>{r.reason}</p>
              {r.status === "pending" && (
                <div className="action-row">
                  {(data.admin
                    ? ["approve", "reject", "corrections"]
                    : ["corrections"]
                  ).map((a) => (
                    <button
                      disabled={busy || (a !== "approve" && !reason.trim())}
                      key={a}
                      className="button secondary"
                      onClick={() =>
                        void action({
                          id: r.id,
                          version: r.version,
                          action: a,
                          reason,
                        })
                      }
                    >
                      {a === "corrections"
                        ? "Request corrections"
                        : a === "approve"
                          ? "Approve verification"
                          : "Reject"}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
          <div className="action-row">
            <button
              className="button secondary"
              disabled={busy || !data || data.page <= 1}
              onClick={() => void load((data?.page ?? 1) - 1)}
            >
              Previous review page
            </button>
            <span>Page {data?.page ?? 1}</span>
            <button
              className="button secondary"
              disabled={busy || !data?.hasMore}
              onClick={() => void load((data?.page ?? 1) + 1)}
            >
              Next review page
            </button>
          </div>
          <h2>Verified accounts</h2>
          {data?.verified.map((p) => (
            <article key={p.id} className="notice">
              <strong>{p.name}</strong>
              <p>
                {p.email} ·{" "}
                {p.verification_version
                  ? `Approved v${p.verification_version}`
                  : "Legacy approval"}
                {p.verification_update_requested ? " · Update requested" : ""}
              </p>
              {data.admin && (
                <button
                  className="button secondary"
                  disabled={busy || !reason.trim()}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Revoke this profile badge and withdraw its public profile?",
                      )
                    )
                      void action({
                        action: "revoke",
                        personId: p.id,
                        version: p.version,
                        reason,
                      });
                  }}
                >
                  Revoke verification
                </button>
              )}
            </article>
          ))}
        </>
      )}
      {tab === "Requirements" && data?.admin && (
        <>
          <h2>Requirements</h2>
          <p>
            Published version {data.policy.version}. Saved drafts do not change
            member requirements. Archive fields by hiding them; their answers
            remain stored.
          </p>
          {fields.map((f, i) => (
            <fieldset key={f.id}>
              <legend>
                {f.id} · {f.type}
              </legend>
              <div className="form-grid">
                <label>
                  Label
                  <input
                    value={f.label}
                    maxLength={200}
                    onChange={(e) => edit(i, { label: e.target.value })}
                  />
                </label>
                <label>
                  Help text
                  <input
                    value={f.help ?? ""}
                    maxLength={500}
                    onChange={(e) => edit(i, { help: e.target.value })}
                  />
                </label>
                <label>
                  Step
                  <select
                    value={f.step}
                    onChange={(e) => edit(i, { step: Number(e.target.value) })}
                  >
                    {verificationSteps.map((s, n) => (
                      <option value={n} key={s}>
                        {n + 1}. {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Character limit
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={f.maxLength ?? 1000}
                    onChange={(e) =>
                      edit(i, { maxLength: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={f.visible}
                  onChange={(e) =>
                    edit(i, {
                      visible: e.target.checked,
                      ...(!e.target.checked ? { required: false } : {}),
                    })
                  }
                />
                {f.visible
                  ? "Visible to members"
                  : "Archived — answers preserved"}
              </label>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={f.required}
                  disabled={!f.visible}
                  onChange={(e) => edit(i, { required: e.target.checked })}
                />
                Required
              </label>
              {["Professional", "Student"].map((c) => (
                <label className="consent" key={c}>
                  <input
                    type="checkbox"
                    checked={f.categories.includes(c)}
                    onChange={(e) =>
                      edit(i, {
                        categories: e.target.checked
                          ? [...f.categories, c]
                          : f.categories.filter((x) => x !== c),
                      })
                    }
                  />
                  {c}
                </label>
              ))}
              {["select", "multiselect"].includes(f.type) && (
                <label>
                  Options (one per line)
                  <textarea
                    value={f.options?.join("\n") ?? ""}
                    onChange={(e) =>
                      edit(i, { options: e.target.value.split("\n") })
                    }
                  />
                </label>
              )}
              {f.type === "document" && (
                <label>
                  Document purpose
                  <select
                    value={f.documentKind}
                    onChange={(e) => edit(i, { documentKind: e.target.value })}
                  >
                    {[
                      "supporting",
                      "photograph",
                      "certificate",
                      "student_evidence",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="button secondary"
                disabled={i === 0}
                onClick={() => {
                  const next = [...fields];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  setFields(next);
                  setDirty(true);
                  setImpact(null);
                }}
              >
                Move up
              </button>
            </fieldset>
          ))}
          <h3>Add custom field</h3>
          <form
            className="member-settings"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget),
                id = String(form.get("id")),
                type = String(form.get("type")) as VerificationField["type"];
              if (
                !/^[a-z][a-zA-Z0-9_]{0,59}$/.test(id) ||
                fields.some((f) => f.id === id)
              ) {
                setMessage(
                  "Use a unique field identifier starting with a lowercase letter.",
                );
                return;
              }
              setFields([
                ...fields,
                {
                  id,
                  label: String(form.get("label")),
                  type,
                  step: Number(form.get("step")),
                  required: false,
                  visible: true,
                  categories: ["Professional", "Student"],
                  maxLength: 1000,
                  ...(["select", "multiselect"].includes(type)
                    ? { options: ["Option 1"] }
                    : {}),
                  ...(type === "document"
                    ? { documentKind: "supporting" }
                    : {}),
                },
              ]);
              setDirty(true);
              setImpact(null);
              e.currentTarget.reset();
            }}
          >
            <label>
              Stable identifier
              <input name="id" required pattern="[a-z][a-zA-Z0-9_]{0,59}" />
            </label>
            <label>
              Label
              <input name="label" required maxLength={200} />
            </label>
            <label>
              Type
              <select name="type">
                {[
                  "text",
                  "multiline",
                  "date",
                  "number",
                  "select",
                  "multiselect",
                  "checkbox",
                  "document",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Step
              <select name="step">
                {verificationSteps.map((s, i) => (
                  <option key={s} value={i}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary">Add field</button>
          </form>
          <h3>Preview</h3>
          {verificationSteps.map((s, i) => (
            <p key={s}>
              {i + 1}. {s}:{" "}
              {fields
                .filter((f) => f.visible && f.step === i)
                .map((f) => f.label + (f.required ? " *" : ""))
                .join(", ")}
            </p>
          ))}
          <div className="action-row">
            <button
              disabled={busy}
              className="button"
              onClick={() => void action({ action: "save", fields, version })}
            >
              Save requirements draft
            </button>
            <button
              disabled={busy || dirty}
              className="button secondary"
              onClick={async () => {
                try {
                  const result = await api<{ affected: number }>(
                    "/api/staff/verification",
                    { action: "impact", fields },
                  );
                  setImpact(result.affected);
                } catch {
                  setMessage("Unable to calculate impact.");
                }
              }}
            >
              Preview impact
            </button>
            <button
              className="button"
              disabled={busy || dirty || impact === null}
              onClick={() => {
                if (
                  window.confirm(
                    `Publish requirements? ${impact} verified accounts may need updates; their badges remain active.`,
                  )
                )
                  void action({ action: "publish", fields, version });
              }}
            >
              Publish requirements
            </button>
          </div>
          {impact !== null && (
            <p>
              {impact} verified accounts need updates. Existing badges remain
              active.
            </p>
          )}
        </>
      )}
      {tab === "Requirements" && !data?.admin && (
        <p>Only administrators can configure requirements.</p>
      )}
      {tab === "History" && (
        <ul>
          {data?.history.map((h, i) => (
            <li key={i}>
              {new Date(h.created_at).toLocaleString("en-IN")} · {h.action} ·{" "}
              {h.entity_id}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
