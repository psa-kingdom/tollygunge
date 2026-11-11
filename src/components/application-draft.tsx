"use client";
import { SignatureInput } from "./signature-input";
import { DocumentPreview } from "./document-preview";
import { VerifyEmail } from "./onboarding-auth";
import { StatusBadge } from "./portal-values";
import { prefillApplicationPhone } from "@/domain/application-contact";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "./operations-client";
import {
  applicable,
  missingFields,
  verificationProgress,
  memberApplicationSteps,
  memberApplicationStep,
  memberApplicationFieldStep,
  adjacentApplicationStep,
  type VerificationField,
} from "@/domain/verification";
import { recovery } from "./draft-recovery";
import { CheckboxDropdown } from "./checkbox-dropdown";
import { AddressForm } from "./address-form";
import {
  emptyAddress,
  copyOfficeToResidence,
  formatAddress,
  type StructuredAddress,
} from "@/domain/address";
import {
  VerificationSubmitted,
  verificationAnswer,
  type SubmittedApplication,
} from "./verification-submitted";
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
  latestSubmission?: SubmittedApplication | null;
  policy: { version: number; fields: VerificationField[] };
  email: string;
  emailVerified: boolean;
  registeredContact?: { email: string; phone: string };
  verified: boolean;
  updateRequested: boolean;
  missing: string[];
  reviews: { status: string; reason: string; created_at: string }[];
};
export function ApplicationDraft({
  name,
  userId,
  initialStep,
  navigation,
}: {
  name: string;
  userId: string;
  initialStep?: number;
  navigation?: React.ReactNode;
}) {
  const router = useRouter();
  const [reviewEditing, setReviewEditing] = useState<string | null>(null);
  const [sameAddress, setSameAddress] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedApplication | null>(null);
  const [draft, setDraft] = useState<Draft>({
      version: 0,
      plan: "Life",
      category: "Professional",
      details: { fullName: name },
      documentIds: [],
      step: memberApplicationStep(initialStep ?? 0),
    }),
    [status, setStatus] = useState<Status | null>(null),
    [message, setMessage] = useState("Loading your saved form…"),
    [local, setLocal] = useState<Draft | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false),
    [converted, setConverted] = useState(false),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
          setSameAddress(!!saved.details.officeAddress && saved.details.officeAddress === saved.details.residenceAddress && (saved.details.officeAddressStructured ?? "") === (saved.details.residenceAddressStructured ?? ""));
          current.current = {
            ...saved,
            details: prefillApplicationPhone(saved.details, st.registeredContact?.phone ?? ""),
            category: "Professional",
            step: memberApplicationStep(initialStep ?? saved.step ?? 0),
          };
          if (current.current.details.phone !== saved.details.phone) {
            dirty.current = true;
            change.current++;
          }
          if (saved.category !== "Professional") {
            dirty.current = true;
            change.current++;
            setConverted(true);
          }
          setDraft(current.current);
        } else if (profile) {
          current.current = {
            ...current.current,
            details: {
              fullName: profile.person.draft.name,
              phone: st.registeredContact?.phone || profile.person.draft.phone,
              organization: profile.person.draft.organization,
            },
          };
          setDraft(current.current);
        } else if (st.registeredContact?.phone) {
          current.current = { ...current.current, details: prefillApplicationPhone(current.current.details, st.registeredContact.phone) };
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
  }, [key, initialStep]);
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
        setFieldErrors(e instanceof ApiError ? e.fieldErrors : {});
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
    setFieldErrors({});
    next = { ...next, category: "Professional", details: sameAddress ? copyOfficeToResidence(next.details) : next.details };
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
    if (f.id === "signatureDocument") return <SignatureInput key={f.id} value={draft.details[f.id]} onUpload={file => upload(f, file)} details={draft.details} />;
    if (["officeAddress", "residenceAddress"].includes(f.id)) {
      if (f.id === "residenceAddress" && sameAddress) return (
        <section className="address-section form-span address-same-preview" key={f.id} aria-label="Permanent address">
          <div className="form-section-heading"><h3>Permanent address</h3><p>Same as correspondence address</p></div>
          <p>{draft.details.officeAddress || "Enter your correspondence address. It will also be used as your permanent address."}</p>
          <small>Updates to the correspondence address will also update this address.</small>
        </section>
      );
      let value;
      try {
        value = draft.details[`${f.id}Structured`]
          ? ({
              ...emptyAddress,
              ...JSON.parse(draft.details[`${f.id}Structured`]),
            } as StructuredAddress)
          : undefined;
      } catch {
        value = undefined;
      }
      return (
        <AddressForm
          key={f.id}
          title={
            f.id === "officeAddress" ? "Correspondence address" : "Permanent address"
          }
          value={value}
          legacy={draft.details[f.id]}
          focusId={`verification-${f.id}`}
          errors={Object.fromEntries(
            Object.entries(fieldErrors)
              .filter(([key]) =>
                key.startsWith(
                  `addresses.${f.id === "officeAddress" ? "office" : "residence"}.`,
                ),
              )
              .map(([key, message]) => [key.split(".").at(-1)!, message]),
          )}
          onChange={(address) =>
            edit({
              ...current.current,
              details: {
                ...current.current.details,
                [`${f.id}Structured`]: JSON.stringify(address),
                [f.id]: formatAddress(address),
              },
            })
          }
        />
      );
    }
    const value = draft.details[f.id] ?? "",
      required =
        f.required ||
        (f.regulated &&
          ["CA", "CS", "ICMAI", "Bar Council"].includes(
            draft.details.professionalBody,
          ));
    const error = fieldErrors[f.id] || fieldErrors[`details.${f.id}`];
    const accessibility = {
      "aria-invalid": !!error,
      "aria-required": required,
      "aria-describedby": error
        ? `verification-${f.id}-error`
        : f.help
          ? `verification-${f.id}-help`
          : undefined,
    };
    const Wrapper = f.type === "multiselect" ? "div" : "label";
    return (
      <Wrapper
        key={f.id}
        className={
          f.type === "checkbox"
            ? "member-check-field"
            : f.type === "multiline"
              ? "form-span"
              : f.type === "multiselect" ? "member-multiselect-field" : undefined
        }
      >
        <span>{f.label}{required ? " *" : " (optional)"}</span>
        {f.type === "multiline" ? (
          <textarea
            id={"verification-" + f.id}
            {...accessibility}
            value={value}
            maxLength={f.maxLength ?? 1000}
            onChange={(e) => answer(f.id, e.target.value)}
          />
        ) : f.type === "select" ? (
          <select
            id={"verification-" + f.id}
            {...accessibility}
            value={value}
            onChange={(e) => answer(f.id, e.target.value)}
          >
            <option value="">Select…</option>
            {f.options?.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : f.type === "multiselect" ? (
          <CheckboxDropdown
            id={"verification-" + f.id}
            label={f.label}
            options={f.options ?? []}
            value={value}
            invalid={!!error}
            describedBy={accessibility["aria-describedby"]}
            required={required}
            onChange={value => answer(f.id, value)}
          />
        ) : f.type === "checkbox" ? (
          <input
            id={"verification-" + f.id}
            {...accessibility}
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => answer(f.id, String(e.target.checked))}
          />
        ) : f.type === "document" ? (
          <>
            <input
              id={"verification-" + f.id}
              {...accessibility}
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
            {...accessibility}
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
        {f.help && <small id={`verification-${f.id}-help`}>{f.help}</small>}
        {error && (
          <small className="field-error" id={`verification-${f.id}-error`}>
            {error}
          </small>
        )}
      </Wrapper>
    );
  }
  const optionalGroups = [
    {
      title: "Family & health details",
      ids: ["fatherName", "spouseName", "bloodGroup", "spouseBloodGroup"],
    },
  ];
  const activeFields =
    status?.policy.fields.filter(
      (f) => !/^(proposer|seconder)/.test(f.id) && ! ["correspondenceAddress", "deliveryPreference"].includes(f.id) && memberApplicationFieldStep(f) === memberApplicationStep(draft.step) && applicable(f, draft.category),
    ) ?? [];
  const photographIndex = activeFields.findIndex(field => field.id === "photograph");
  const registrationIndex = activeFields.findIndex(field => field.id === "registration");
  if (photographIndex >= 0 && registrationIndex >= 0 && photographIndex > registrationIndex) {
    const [photograph] = activeFields.splice(photographIndex, 1);
    activeFields.splice(registrationIndex + 1, 0, photograph);
  }
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
  const progress = status ? verificationProgress(status.policy.fields, draft.details, draft.category, status.emailVerified) : null;
  const standardPersonalIds = ["gender", "fullName", "dateOfBirth", "photograph"];
  const standardContactIds = ["phone", "officePhone", "residencePhone", "fax"];
  const preferenceIds = ["correspondenceAddress", "deliveryPreference"];
  const professionalIds = ["qualification", "professionalStatus", "organization", "professionalBody", "registration", "certificate"];
  const interestIds = ["contributions", "contributionsOther", "interests", "interestsOther"];
  const directFields = activeFields.filter(field => !optionalIds.includes(field.id) || isRequired(field));
  function orderedFields(ids: string[]) {
    return ids.flatMap(id => directFields.filter(field => field.id === id)).map(renderField);
  }
  function renderAddresses() {
    const office = directFields.find(field => field.id === "officeAddress");
    const residence = directFields.find(field => field.id === "residenceAddress");
    if (!office && !residence) return null;
    return <section className="application-form-section">
      <div className="application-section-heading"><h3>Addresses</h3>
        {office && residence && <label className="address-same-toggle">
          <input type="checkbox" checked={sameAddress} onChange={event => {
            const checked = event.target.checked;
            setSameAddress(checked);
            if (checked) edit({ ...current.current, details: copyOfficeToResidence(current.current.details) });
          }} />
          Permanent address is the same as correspondence
        </label>}
      </div>
      <div className="address-pair-grid">{office && renderField(office)}{residence && renderField(residence)}</div>
    </section>;
  }
  const completedSubmission = submitted ?? status?.latestSubmission;
  if (
    ready &&
    status &&
    completedSubmission &&
    !editingSubmission &&
    (submitted ||
      status.reviews[0]?.status === "pending" ||
      (status.reviews[0]?.status === "approved" && !status.updateRequested))
  ) {
    return (
      <div className="member-journey">{navigation}<VerificationSubmitted
        submission={completedSubmission}
        fields={completedSubmission.fields ?? status.policy.fields}
        reviewStatus={submitted ? "pending" : status.reviews[0]?.status}
        successOpen={successOpen}
        onDismiss={() => setSuccessOpen(false)}
        onEdit={() => {
          setEditingSubmission(true);
          setMessage(
            "Editing your saved draft. Submit it again to send updated details for review.",
          );
        }}
      /></div>
    );
  }
  return (
    <div className="member-journey">
      <div className="application-topline">
        {navigation}
        <section className="application-completion" aria-label="Application completion">
          <div><strong id="application-completion-label">{progress ? `${progress.percent}% complete` : "Loading progress…"}</strong>
            {progress && <span>{progress.completed} of {progress.total} required items</span>}</div>
          <progress aria-labelledby="application-completion-label" max={100} {...(progress ? { value: progress.percent } : {})} />
        </section>
      </div>
      {status && (
        <>
          <section aria-label="Profile verification status">
            <StatusBadge tone={status.verified ? "success" : status.reviews[0]?.status === "rejected" ? "error" : "pending"}>
              {status.verified ? status.updateRequested ? "Verified · Update requested" : "Verified" : ["pending", "submitted"].includes(status.reviews[0]?.status) ? "Under review" : status.reviews[0]?.status === "corrections" ? "Corrections requested" : "Not verified"}
            </StatusBadge>
            <VerifyEmail email={status.email} verified={status.emailVerified} />
          </section>
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
      <div className="application-step-layout">
      <nav className="member-stepper" aria-label="Application steps">
        {memberApplicationSteps.map(({ label: s, step: i }) => (
          <button
            key={s}
            className="button secondary"
            aria-label={s}
            aria-current={memberApplicationStep(draft.step) === i ? "step" : undefined}
            disabled={!ready || busy}
            onClick={async () => {
              if (await save()) {
                edit({ ...current.current, step: i });
                await save();
              }
            }}
          >
            <span>{s}</span>
          </button>
        ))}
      </nav>
      <div className="application-step-content">
      {converted && (
        <p className="notice" role="status">
          Your previous Student draft is now a professional application. Saved
          answers and documents are retained. Add your professional details before submitting.
        </p>
      )}
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
        <h2 className="sr-only">{memberApplicationSteps.find(item => item.step === memberApplicationStep(draft.step))?.label}</h2>
        {draft.step !== 4 && <fieldset disabled={!ready || busy || conflict}>
          {memberApplicationStep(draft.step) === 1 ? <div className="application-form-sections">
            {directFields.some(field => standardPersonalIds.includes(field.id)) && <section className="application-form-section">
              <h3>Personal details</h3>
              <div className="form-grid application-personal-grid">{orderedFields(standardPersonalIds)}</div>
            </section>}
            <section className="application-form-section">
              <h3>Contact details</h3>
              <div className="form-grid">
                <label>Registered email<input value={status?.registeredContact?.email || status?.email || ""} readOnly /></label>
                {orderedFields(standardContactIds)}
              </div>
            </section>
            {renderAddresses()}
            {directFields.some(field => ![...standardPersonalIds, ...standardContactIds, ...preferenceIds, "officeAddress", "residenceAddress"].includes(field.id)) && <section className="application-form-section">
              <h3>Additional details</h3>
              <div className="form-grid">{directFields.filter(field => ![...standardPersonalIds, ...standardContactIds, ...preferenceIds, "officeAddress", "residenceAddress"].includes(field.id)).map(renderField)}</div>
            </section>}
          </div> : memberApplicationStep(draft.step) === 0 ? <div className="application-form-sections">
            <section className="application-form-section">
              <h3>Membership</h3>
              <div className="form-grid">
                <label>Membership plan<input value={draft.plan} readOnly /><small>Assigned by your administrator.</small></label>

              </div>
            </section>
            {directFields.some(field => professionalIds.includes(field.id)) && <section className="application-form-section">
              <h3>Professional details</h3>
              <div className="form-grid">{orderedFields(professionalIds)}</div>
            </section>}
            {directFields.some(field => interestIds.includes(field.id)) && <section className="application-form-section">
              <h3>Contributions &amp; interests</h3>
              <div className="form-grid">{orderedFields(interestIds)}</div>
            </section>}
            {directFields.some(field => !["photograph", ...professionalIds, ...interestIds].includes(field.id)) && <section className="application-form-section">
              <h3>Additional professional details</h3>
              <div className="form-grid">{directFields.filter(field => !["photograph", ...professionalIds, ...interestIds].includes(field.id)).map(renderField)}</div>
            </section>}
          </div> : <div className="form-grid">{directFields.map(renderField)}</div>}
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
        </fieldset>}
        {draft.step === 4 && (
          <section>
            <h3>Review your details</h3>
            <dl className="application-review-list">
              {status?.policy.fields
                .filter(f => !/^(proposer|seconder)/.test(f.id) && !["correspondenceAddress", "deliveryPreference"].includes(f.id) && memberApplicationFieldStep(f) !== 4 && applicable(f, draft.category) && (draft.details[f.id] || isRequired(f)))
                .map(f => {
                  const label = f.id === "officeAddress" ? "Correspondence address" : f.id === "residenceAddress" ? "Permanent address" : f.label;
                  const editing = reviewEditing === f.id;
                  return <div key={f.id} className="application-review-row">
                    <dt><strong>{label}</strong></dt>
                    <dd>
                      <div className="application-review-value">
                        {f.type === "document" && draft.details[f.id] ? <DocumentPreview id={draft.details[f.id]} label={f.label} /> : <span>{draft.details[f.id] ? verificationAnswer(f, draft.details[f.id]) : "Not provided"}</span>}
                        <button className="text-button" type="button" aria-label={`${editing ? "Close editor for" : "Edit"} ${label}`} aria-expanded={editing} aria-controls={`review-edit-${f.id}`} disabled={!ready || busy || conflict} onClick={async () => {
                          if (!(await save())) return;
                          if (!editing && f.id === "residenceAddress") setSameAddress(false);
                          setReviewEditing(editing ? null : f.id);
                          if (!editing) requestAnimationFrame(() => document.getElementById(`review-edit-${f.id}`)?.querySelector<HTMLElement>("input,select,textarea,summary,button")?.focus());
                        }}>{editing ? "Close" : "Edit"}</button>
                      </div>
                      {editing && <fieldset id={`review-edit-${f.id}`} className="application-review-editor" disabled={!ready || busy || conflict}>
                        {renderField(f)}
                        <button className="button secondary" type="button" onClick={async () => {
                          if (await save()) setReviewEditing(null);
                        }}>Save changes</button>
                      </fieldset>}
                    </dd>
                  </div>;
                })}
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
                          edit({ ...current.current, step: memberApplicationFieldStep(field) });
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
            <fieldset className="application-final-declaration" disabled={!ready || busy || conflict}>
              <legend className="sr-only">Declaration and signature</legend>
              <div className="form-grid">{directFields.map(renderField)}</div>
            </fieldset>
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
                  setSubmitted({
                    ...current.current,
                    details: { ...current.current.details },
                    submittedAt: new Date().toISOString(),
                  });
                  setEditingSubmission(false);
                  setSuccessOpen(true);
                  // Submission has succeeded even if the follow-up refresh fails.
                  void api<Status>("/api/member/verification")
                    .then((fresh) => {
                      setStatus(fresh);
                      if (fresh.latestSubmission) setSubmitted(null);
                    })
                    .catch(() => {});
                  setMessage("Submitted for administrator review.");
                } catch (e) {
                  setFieldErrors(e instanceof ApiError ? e.fieldErrors : {});
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
          {memberApplicationStep(draft.step) > 0 && (
            <button
              className="button secondary"
              type="button"
              disabled={!ready || busy}
              onClick={async () => {
                if (await save()) {
                  edit({ ...current.current, step: adjacentApplicationStep(current.current.step, -1) });
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
                  edit({ ...current.current, step: adjacentApplicationStep(current.current.step, 1) });
                  await save();
                }
              }}
            >
              Continue
            </button>
          )}
        </div>
      </form>
      </div>
      </div>
      {Object.keys(fieldErrors).length > 0 && (
        <div className="member-validation-summary" role="alert">
          <strong>Check these details</strong>
          <ul>
            {Object.entries(fieldErrors).map(([key, error]) => (
              <li key={key}>
                <button
                  className="text-button"
                  onClick={() => {
                    const fieldId = key.startsWith("addresses.office.")
                      ? "officeAddress"
                      : key.startsWith("addresses.residence.")
                        ? "residenceAddress"
                        : key.split(".").at(-1);
                    const field = status?.policy.fields.find(
                      (f) => f.id === fieldId,
                    );
                    if (!field) return;
                    current.current = { ...current.current, step: memberApplicationFieldStep(field) };
                    setDraft(current.current);
                    requestAnimationFrame(() => {
                      const input = document.getElementById(
                        `verification-${field.id}`,
                      );
                      const details = input?.closest("details");
                      if (details) details.open = true;
                      const invalid = input
                        ?.closest(".address-section")
                        ?.querySelector<HTMLElement>('[aria-invalid="true"]');
                      (invalid || input)?.focus();
                    });
                  }}
                >
                  {error}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="member-save-status" role="status" aria-live="polite">
        {message}
      </p>
      {conflict && (
        <button className="button" onClick={() => window.location.reload()}>
          Reload latest form (recovery retained)
        </button>
      )}
      <Link
        href="/member/events"
        onClick={async (e) => {
          e.preventDefault();
          if (await save()) router.push("/member/events");
        }}
      >
        Return to events
      </Link>
    </div>
  );
}
