"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "./operations-client";
import {
  applicable,
  missingFields,
  verificationSteps,
  type VerificationField,
} from "@/domain/verification";
import { recovery } from "./draft-recovery";
import { VerifyEmail } from "./onboarding-auth";
type Draft = {
  version: number;
  updated_at?: string;
  recoveryAt?: number;
  plan: string;
  category: string;
  details: Record<string, string>;
  documentIds: string[];
  step: number;
};
type Status = {
  policy: { version: number; fields: VerificationField[] };
  email: string;
  emailVerified: boolean;
  verified: boolean;
  updateRequested: boolean;
  missing: string[];
  reviews: { status: string; reason: string; created_at: string }[];
};
export function ApplicationDraft({
  name,
  userId,
}: {
  name: string;
  userId: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({
      version: 0,
      plan: "Annual",
      category: "Professional",
      details: { fullName: name },
      documentIds: [],
      step: 0,
    }),
    [status, setStatus] = useState<Status | null>(null),
    [message, setMessage] = useState("Loading your saved form…"),
    [local, setLocal] = useState<Draft | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false);
  const current = useRef(draft),
    dirty = useRef(false),
    saving = useRef<Promise<boolean> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    change = useRef(0);
  const key = "application-" + userId;
  useEffect(() => {
    let active = true;
    Promise.all([
      api<Draft | null>("/api/member/application"),
      api<Status>("/api/member/verification"),
      recovery(key).catch(() => null),
      api<{
        person: {
          draft: { name: string; phone: string; organization: string };
        };
      }>("/api/member/profile").catch(() => null),
    ])
      .then(([saved, st, buffer, profile]) => {
        if (!active) return;
        if (saved) {
          current.current = { ...saved, step: saved.step ?? 0 };
          setDraft(current.current);
        } else if (profile) {
          current.current = {
            ...current.current,
            details: {
              fullName: profile.person.draft.name,
              phone: profile.person.draft.phone,
              organization: profile.person.draft.organization,
            },
          };
          setDraft(current.current);
        }
        setStatus(st);
        const recovered = buffer as Draft | null;
        setLocal(
          recovered &&
            (!saved?.updated_at ||
              (recovered.recoveryAt ?? 0) > Date.parse(saved.updated_at))
            ? recovered
            : null,
        );
        setReady(true);
        setMessage(
          saved
            ? "Saved form restored."
            : "Your progress will save automatically.",
        );
      })
      .catch(() =>
        setMessage("Unable to load your saved form. Reload to try again."),
      );
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key]);
  async function save(): Promise<boolean> {
    if (saving.current) {
      if (!(await saving.current)) return false;
      if (dirty.current) return save();
      return true;
    }
    if (!dirty.current) return true;
    if (!ready || conflict) return false;
    const snapshot = {
        ...current.current,
        details: { ...current.current.details },
      },
      revision = change.current;
    setMessage("Saving…");
    const work = (async () => {
      try {
        const saved = await api<Draft>("/api/member/application", snapshot);
        current.current = { ...current.current, version: saved.version };
        setDraft({ ...current.current });
        if (change.current === revision) {
          dirty.current = false;
          await recovery(key, null, snapshot).catch(() => {});
          setMessage("Saved");
        } else {
          await recovery(key, current.current).catch(() => {});
          setMessage("Saving recent changes…");
        }
        return true;
      } catch (e) {
        const text = e instanceof Error ? e.message : "Save failed.";
        if (text.includes("another tab")) setConflict(true);
        setMessage(
          navigator.onLine
            ? text
            : "Offline. Changes are kept on this device; reconnect and retry.",
        );
        return false;
      } finally {
        saving.current = null;
      }
    })();
    saving.current = work;
    const result = await work;
    if (result && dirty.current) return save();
    return result;
  }
  function edit(next: Draft) {
    current.current = next;
    dirty.current = true;
    change.current++;
    setDraft(next);
    setMessage("Unsaved changes");
    void recovery(key, next).catch(() =>
      setMessage(
        "Local recovery unavailable. Keep this page open until Saved.",
      ),
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void save();
    }, 500);
  }
  function answer(id: string, value: string) {
    edit({
      ...current.current,
      details: { ...current.current.details, [id]: value },
    });
  }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const retry = () => {
      void save();
    };
    const navigate = (e: MouseEvent) => {
      if (
        !dirty.current ||
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const link = (e.target as Element)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!link || link.target || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname === location.pathname)
        return;
      e.preventDefault();
      e.stopPropagation();
      void save().then((saved) => {
        if (saved) router.push(url.pathname + url.search + url.hash);
      });
    };
    document.addEventListener("click", navigate, true);
    window.addEventListener("beforeunload", warn);
    window.addEventListener("online", retry);
    return () => {
      document.removeEventListener("click", navigate, true);
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("online", retry);
    };
  });
  async function upload(f: VerificationField, file: File) {
    if (current.current.version === 0) edit({ ...current.current });
    if (!(await save())) return;
    setBusy(true);
    setMessage("Uploading…");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", f.documentKind ?? "supporting");
      form.set("fieldId", f.id);
      form.set("applicationVersion", String(current.current.version));
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/api/documents");
        request.responseType = "json";
        request.timeout = 120000;
        request.upload.onprogress = (event) => {
          if (event.lengthComputable)
            setMessage(
              `Uploading ${Math.round((event.loaded / event.total) * 100)}% — awaiting saved confirmation`,
            );
        };
        request.onload = () =>
          request.status >= 200 && request.status < 300
            ? resolve()
            : reject(Error(request.response?.error || "Upload failed. Retry."));
        request.onerror = () =>
          reject(Error("Upload failed. Check your connection and retry."));
        request.ontimeout = () => reject(Error("Upload timed out. Retry."));
        request.send(form);
      });
      const fresh = await api<Draft>("/api/member/application");
      current.current = fresh;
      setDraft(fresh);
      setMessage("Upload saved");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed. Retry.");
    } finally {
      setBusy(false);
    }
  }
  function renderField(f: VerificationField) {
    const value = draft.details[f.id] ?? "",
      required =
        f.required ||
        (f.regulated &&
          ["CA", "CS", "ICMAI", "Bar Council"].includes(
            draft.details.professionalBody,
          ));
    return (
      <label
        key={f.id}
        className={f.type === "checkbox" ? "member-check-field" : undefined}
      >
        {f.label}
        {required ? " *" : " (optional)"}
        {f.help && <small>{f.help}</small>}
        {f.type === "multiline" ? (
          <textarea
            id={"verification-" + f.id}
            value={value}
            maxLength={f.maxLength ?? 1000}
            onChange={(e) => answer(f.id, e.target.value)}
          />
        ) : f.type === "select" ? (
          <select
            id={"verification-" + f.id}
            value={value}
            onChange={(e) => answer(f.id, e.target.value)}
          >
            <option value="">Select…</option>
            {f.options?.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : f.type === "multiselect" ? (
          <select
            id={"verification-" + f.id}
            multiple
            value={value ? JSON.parse(value) : []}
            onChange={(e) =>
              answer(
                f.id,
                JSON.stringify(
                  [...e.target.selectedOptions].map((o) => o.value),
                ),
              )
            }
          >
            {f.options?.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : f.type === "checkbox" ? (
          <input
            id={"verification-" + f.id}
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => answer(f.id, String(e.target.checked))}
          />
        ) : f.type === "document" ? (
          <>
            <input
              id={"verification-" + f.id}
              type="file"
              accept={
                f.documentKind === "photograph"
                  ? "image/jpeg,image/png"
                  : "application/pdf,image/jpeg,image/png"
              }
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(f, file);
              }}
            />
            {value ? (
              <a
                href={"/api/documents/" + value}
                target="_blank"
                rel="noreferrer"
              >
                View saved document
              </a>
            ) : (
              <small>No document uploaded. Maximum 5 MB.</small>
            )}
          </>
        ) : (
          <input
            id={"verification-" + f.id}
            type={
              ["date", "number"].includes(f.type)
                ? f.type
                : f.id === "phone"
                  ? "tel"
                  : "text"
            }
            value={value}
            maxLength={f.maxLength ?? 1000}
            onChange={(e) => answer(f.id, e.target.value)}
          />
        )}
      </label>
    );
  }
  const optionalGroups = [
    {
      title: "Family & health details",
      ids: ["fatherName", "spouseName", "bloodGroup", "spouseBloodGroup"],
    },
    {
      title: "Additional contact numbers",
      ids: ["officePhone", "residencePhone", "fax"],
    },
    {
      title: "Referrals",
      ids: [
        "proposerName",
        "proposerNumber",
        "proposerSignature",
        "seconderName",
        "seconderNumber",
        "seconderSignature",
      ],
    },
  ];
  const activeFields =
    status?.policy.fields.filter(
      (f) => f.step === draft.step && applicable(f, draft.category),
    ) ?? [];
  const isRequired = (f: VerificationField) =>
    f.required ||
    !!(
      f.regulated &&
      ["CA", "CS", "ICMAI", "Bar Council"].includes(
        draft.details.professionalBody,
      )
    );
  const optionalIds = optionalGroups.flatMap((g) => g.ids);
  useEffect(() => {
    if (!status) return;
    const invalid = status.policy.fields.find(
      (f) =>
        message.includes(f.label) && /Check|too long|invalid/i.test(message),
    );
    if (invalid) {
      const input = document.getElementById("verification-" + invalid.id);
      const section = input?.closest("details");
      if (section) section.open = true;
      input?.focus();
    }
  }, [message, status]);
  const missing = status
    ? missingFields(
        status.policy.fields,
        draft.details,
        draft.category,
        status.emailVerified,
      )
    : [];
  return (
    <div className="member-journey">
      <p className="member-form-intro">
        Profile verification confirms reviewed details. Membership approval and
        payments are separate. Only fields marked * are required for your
        profile review.
      </p>
      {status && (
        <>
          <VerifyEmail email={status.email} verified={status.emailVerified} />
          <p>
            <strong>{status.verified ? "Verified" : "Not yet verified"}</strong>
            {status.updateRequested
              ? " · Update requested — your badge remains active."
              : ""}
          </p>
          {status.reviews[0] && (
            <p>
              Latest review: {status.reviews[0].status}{" "}
              {status.reviews[0].reason}
            </p>
          )}
        </>
      )}
      {local && (
        <div className="notice">
          <p>
            Unsaved details from this device are available.{" "}
            {local.version !== draft.version
              ? "The server also changed. Recovering replaces its draft details; accepted profile details remain unchanged."
              : ""}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              if (
                local.version !== current.current.version &&
                !window.confirm(
                  "Replace the current saved draft with these recovered details?",
                )
              )
                return;
              edit({ ...local, version: current.current.version });
              setLocal(null);
            }}
          >
            Recover details
          </button>
          <button
            className="button secondary"
            onClick={() => {
              void recovery(key, null);
              setLocal(null);
            }}
          >
            Discard recovery
          </button>
        </div>
      )}
      <nav className="member-stepper" aria-label="Application steps">
        {verificationSteps.map((s, i) => (
          <button
            key={s}
            aria-label={`${i + 1}. ${s}`}
            className="button secondary"
            aria-current={draft.step === i ? "step" : undefined}
            disabled={!ready || busy}
            onClick={async () => {
              if (await save()) {
                edit({ ...current.current, step: i });
                await save();
              }
            }}
          >
            <span className="member-step-number" aria-hidden="true">
              {i + 1}
            </span>
            <span>{s}</span>
          </button>
        ))}
      </nav>
      <form
        className="member-settings member-form-card"
        onBlur={() => {
          void save();
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          await save();
        }}
      >
        <div className="member-form-heading">
          <span className="eyebrow">STEP {draft.step + 1} OF 5</span>
          <h2>{verificationSteps[draft.step]}</h2>
          <p>
            Fields marked * are required. You can save an incomplete form and
            return later.
          </p>
        </div>
        <fieldset disabled={!ready || busy || conflict}>
          <div className="form-grid">
            {draft.step === 0 && (
              <>
                <label>
                  Applicant category
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      edit({ ...current.current, category: e.target.value })
                    }
                  >
                    <option>Professional</option>
                    <option>Student</option>
                  </select>
                </label>
                <label>
                  Membership plan preference
                  <select
                    value={draft.plan}
                    onChange={(e) =>
                      edit({ ...current.current, plan: e.target.value })
                    }
                  >
                    <option>Annual</option>
                    <option>Life</option>
                    <option>Patron</option>
                  </select>
                </label>
                <p>Plan preference does not create paid membership.</p>
              </>
            )}
            {draft.step === 2 && (
              <label>
                Account email
                <input value={status?.email ?? ""} readOnly />
                <small>
                  Email verification is separate from profile verification.
                </small>
              </label>
            )}
            {activeFields
              .filter((f) => !optionalIds.includes(f.id) || isRequired(f))
              .map(renderField)}
          </div>
          {optionalGroups.map((group) => {
            const fields = activeFields.filter(
              (f) => group.ids.includes(f.id) && !isRequired(f),
            );
            return fields.length ? (
              <details
                className="member-optional-section"
                key={group.title}
                open={fields.some((f) => !!draft.details[f.id]) || undefined}
              >
                <summary>
                  {group.title}
                  <span>Optional</span>
                </summary>
                <div className="form-grid">{fields.map(renderField)}</div>
              </details>
            ) : null;
          })}
        </fieldset>
        {draft.step === 4 && (
          <section>
            <h3>Review your details</h3>
            <dl>
              {status?.policy.fields
                .filter(
                  (f) => applicable(f, draft.category) && draft.details[f.id],
                )
                .map((f) => (
                  <div key={f.id}>
                    <dt>{f.label}</dt>
                    <dd>
                      {f.type === "document"
                        ? "Document saved"
                        : draft.details[f.id]}
                    </dd>
                  </div>
                ))}
            </dl>
            <h3>Before submission</h3>
            {missing.length ? (
              <ul>
                {missing.map((x) => (
                  <li key={x}>
                    <button
                      className="text-button"
                      type="button"
                      onClick={async () => {
                        if (x === "Verify your account email") {
                          document
                            .getElementById("verification-email-action")
                            ?.focus();
                          return;
                        }
                        const field = status?.policy.fields.find(
                          (f) =>
                            f.label === x ||
                            (x === "Selected correspondence address" &&
                              f.id ===
                                (draft.details.correspondenceAddress ===
                                "Office"
                                  ? "officeAddress"
                                  : "residenceAddress")),
                        );
                        if (field && (await save())) {
                          edit({ ...current.current, step: field.step });
                          await save();
                          requestAnimationFrame(() =>
                            (() => {
                              const input = document.getElementById(
                                "verification-" + field.id,
                              );
                              const section = input?.closest("details");
                              if (section) section.open = true;
                              input?.focus();
                            })(),
                          );
                        }
                      }}
                    >
                      {x}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Required details are complete.</p>
            )}
            <button
              type="button"
              className="button"
              disabled={!ready || busy || missing.length > 0 || conflict}
              onClick={async () => {
                if (!(await save())) return;
                setBusy(true);
                try {
                  await api("/api/member/verification", {
                    version: current.current.version,
                  });
                  setStatus(await api<Status>("/api/member/verification"));
                  setMessage("Submitted for administrator review.");
                } catch (e) {
                  setMessage(
                    e instanceof Error ? e.message : "Submission failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Submit for profile verification
            </button>
          </section>
        )}
        <div className="form-actions">
          {draft.step > 0 && (
            <button
              className="button secondary"
              type="button"
              disabled={!ready || busy}
              onClick={async () => {
                if (await save()) {
                  edit({ ...current.current, step: current.current.step - 1 });
                  await save();
                }
              }}
            >
              Back
            </button>
          )}
          <button
            className="button secondary"
            disabled={!ready || busy || conflict}
          >
            Save now
          </button>
          {draft.step < 4 && (
            <button
              className="button"
              type="button"
              disabled={!ready || busy || conflict}
              onClick={async () => {
                if (await save()) {
                  edit({ ...current.current, step: current.current.step + 1 });
                  await save();
                }
              }}
            >
              Continue
            </button>
          )}
        </div>
      </form>
      <p className="member-save-status" role="status" aria-live="polite">
        {message}
      </p>
      {conflict && (
        <button className="button" onClick={() => window.location.reload()}>
          Reload latest form (recovery retained)
        </button>
      )}
      <Link
        href="/member"
        onClick={async (e) => {
          e.preventDefault();
          if (await save()) router.push("/member");
        }}
      >
        Return to dashboard
      </Link>
    </div>
  );
}
