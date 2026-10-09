"use client";
import { useEffect, useState } from "react";
import { useEmailEditGuard } from "./email-edit-guard";
import { VerificationReviews } from "./verification-reviews";
import { api } from "./operations-client";
import {
  verificationSteps,
  type VerificationField,
} from "@/domain/verification";
export type Review = {
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
export type VerificationData = {
  admin: boolean;
  page: number;
  hasMore: boolean;
  reviewsMore: boolean;
  verifiedMore: boolean;
  verifiedPage: number;
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
  const [data, setData] = useState<VerificationData | null>(null),
    [fields, setFields] = useState<VerificationField[]>([]),
    [version, setVersion] = useState(0),
    [tab, setTab] = useState("Review queue"),
    [message, setMessage] = useState(""),
    [historyQuery, setHistoryQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [impact, setImpact] = useState<number | null>(null);
  const guard = useEmailEditGuard(dirty);
  async function load(page = 1) {
    const d = await api<VerificationData>(
      "/api/staff/verification?page=" + page,
    );
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
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save.");
      return false;
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
      <p className="verification-intro">
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
            tabIndex={tab === t ? 0 : -1}
            onKeyDown={(e) => {
              const tabs = ["Review queue", "Requirements", "History"];
              const n = tabs.indexOf(t);
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 2
                      : (n + (e.key === "ArrowRight" ? 1 : 2)) % 3;
                const container = e.currentTarget.parentElement;
                guard.proceed(() => {
                  setFields(
                    data?.draft?.fields ?? data?.policy.fields ?? fields,
                  );
                  setDirty(false);
                  setImpact(null);
                  setTab(tabs[next]);
                  (
                    container?.querySelectorAll("button")[
                      next
                    ] as HTMLButtonElement
                  )?.focus();
                });
              }
            }}
            className="button secondary"
            onClick={() =>
              guard.proceed(() => {
                setFields(data?.draft?.fields ?? data?.policy.fields ?? fields);
                setDirty(false);
                setImpact(null);
                setTab(t);
              })
            }
          >
            {t}
          </button>
        ))}
      </div>
      <p role="status">{message}</p>
      {tab === "Review queue" && (
        <VerificationReviews
          data={data}
          busy={busy}
          action={action}
          load={load}
        />
      )}
      {tab === "Requirements" && data?.admin && (
        <>
          <h2>Requirements</h2>
          <p>
            Published version {data.policy.version}. Saved drafts do not change
            member requirements. Archive fields by hiding them; their answers
            remain stored.
          </p>
          {verificationSteps.map((step, stepIndex) => (
            <section className="requirements-step" key={step}>
              <h3>
                {stepIndex + 1}. {step}
              </h3>
              {fields.map(
                (f, i) =>
                  f.step === stepIndex && (
                    <details key={f.id} className="requirement-settings">
                      <summary>
                        {f.label}{" "}
                        <small>
                          {f.visible
                            ? f.required
                              ? "Required"
                              : "Optional"
                            : "Archived"}
                        </small>
                      </summary>
                      <fieldset>
                        <legend>
                          {f.id} · {f.type}
                        </legend>
                        <div className="form-grid">
                          <label>
                            Label
                            <input
                              value={f.label}
                              maxLength={200}
                              onChange={(e) =>
                                edit(i, { label: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Help text
                            <input
                              value={f.help ?? ""}
                              maxLength={500}
                              onChange={(e) =>
                                edit(i, { help: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Step
                            <select
                              value={f.step}
                              onChange={(e) =>
                                edit(i, { step: Number(e.target.value) })
                              }
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
                                ...(!e.target.checked
                                  ? { required: false }
                                  : {}),
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
                            onChange={(e) =>
                              edit(i, { required: e.target.checked })
                            }
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
                              onChange={(e) =>
                                edit(i, { documentKind: e.target.value })
                              }
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
                    </details>
                  ),
              )}
            </section>
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
        <section className="verification-history">
          <label>
            Filter history
            <input
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              placeholder="Action or identifier"
            />
          </label>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {data?.history
                  .filter((h) =>
                    (h.action + " " + h.entity_id)
                      .toLowerCase()
                      .includes(historyQuery.toLowerCase()),
                  )
                  .map((h, i) => (
                    <tr key={i}>
                      <td>{new Date(h.created_at).toLocaleString("en-IN")}</td>
                      <td>
                        {h.action
                          .replace("verification.", "")
                          .replaceAll("_", " ")}
                      </td>
                      <td>{h.entity_id}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p>Latest 100 verification audit entries.</p>
        </section>
      )}
    </>
  );
}
