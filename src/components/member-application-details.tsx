"use client";

import { useEffect, useState } from "react";
import { addressKeys, formatAddress, parseAddress } from "@/domain/address";
import {
  applicable,
  verificationSteps,
  type VerificationField,
} from "@/domain/verification";
import { AddressForm } from "./address-form";
import { api } from "./operations-client";
import styles from "./member-review.module.css";

type Application = {
  version: number;
  category: string;
  fields: VerificationField[];
  editableIds: string[];
  details: Record<string, string>;
};

const hiddenEditFields = new Set([
  "contributions",
  "contributionsOther",
  "interests",
  "interestsOther",
]);

function choices(value: string) {
  try {
    const result = JSON.parse(value);
    return Array.isArray(result)
      ? result.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function answer(field: VerificationField, value: string) {
  if (!value) return "Not supplied";
  if (field.type === "checkbox") return value === "true" ? "Yes" : "No";
  if (field.type === "multiselect") return choices(value).join(", ") || value;
  if (field.type === "document")
    return (
      <a
        href={"/api/documents/" + encodeURIComponent(value)}
        target="_blank"
        rel="noreferrer"
      >
        View evidence
      </a>
    );
  return value;
}

export function MemberApplicationDetails({
  userId,
  editing,
  onDirtyChange,
}: {
  userId: string;
  editing: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [application, setApplication] = useState<Application | null>();
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    api<Application | null>(
      "/api/staff/member-application?userId=" + encodeURIComponent(userId),
    )
      .then((result) => {
        if (active) setApplication(result);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (!application)
    return (
      <p role="status">
        {message ||
          (application === null
            ? "No profile details submitted yet. The member’s application details will appear here once they complete their profile."
            : "Loading onboarding details…")}
      </p>
    );

  const details = { ...application.details, ...changes };
  const fields = application.fields.filter(
    (field) =>
      (!editing || !hiddenEditFields.has(field.id)) &&
      (applicable(field, application.category) || details[field.id]),
  );
  function update(values: Record<string, string>) {
    setChanges((previous) => ({ ...previous, ...values }));
    setMessage("");
    onDirtyChange(true);
  }

  function input(field: VerificationField) {
    const value = details[field.id] ?? "";
    const set = (value: string) => update({ [field.id]: value });
    if (addressKeys.some((key) => key === field.id)) {
      const key = field.id + "Structured";
      let address;
      try {
        if (details[key]) address = parseAddress(details[key]);
      } catch {
        /* Keep legacy text visible. */
      }
      return (
        <AddressForm
          title={field.label}
          value={address}
          legacy={value}
          onChange={(next) =>
            update({
              [key]: JSON.stringify(next),
              [field.id]: formatAddress(next),
            })
          }
        />
      );
    }
    if (field.type === "multiselect") {
      const selected = choices(value);
      return (
        <fieldset>
          <legend>{field.label}</legend>
          {(field.options ?? []).map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) =>
                  set(
                    JSON.stringify(
                      event.target.checked
                        ? [...selected, option]
                        : selected.filter((item) => item !== option),
                    ),
                  )
                }
              />{" "}
              {option}
            </label>
          ))}
        </fieldset>
      );
    }
    if (field.type === "checkbox")
      return (
        <label>
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(event) => set(String(event.target.checked))}
          />{" "}
          {field.label}
        </label>
      );

    return (
      <label>
        {field.label}
        {field.type === "select" ? (
          <select value={value} onChange={(event) => set(event.target.value)}>
            <option value="">Not supplied</option>
            {value && !field.options?.includes(value) && (
              <option>{value}</option>
            )}
            {field.options?.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        ) : field.type === "multiline" ? (
          <textarea
            value={value}
            maxLength={field.maxLength}
            onChange={(event) => set(event.target.value)}
          />
        ) : (
          <input
            type={
              field.type === "date" || field.type === "number"
                ? field.type
                : "text"
            }
            step={field.type === "number" ? "any" : undefined}
            value={value}
            maxLength={field.maxLength}
            onChange={(event) => set(event.target.value)}
          />
        )}
      </label>
    );
  }

  return (
    <form
      className={styles.applicationDetails}
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          const saved = await api<Pick<Application, "details" | "version">>(
            "/api/staff/member-application",
            { userId, version: application.version, changes },
          );
          setApplication({ ...application, ...saved });
          setChanges({});
          setMessage("Onboarding details saved.");
          onDirtyChange(false);
        } catch (error) {
          setMessage((error as Error).message);
        } finally {
          setSaving(false);
        }
      }}
    >
      <h4>Onboarding application</h4>
      <fieldset
        disabled={saving || uploading}
        className={styles.applicationFields}
      >
        {verificationSteps.map((step, index) => {
          const group = fields.filter((field) => field.step === index);
          return (
            group.length > 0 && (
              <section key={step}>
                <h5>{step}</h5>
                {group.map((field) => (
                  <div
                    key={field.id}
                    className={
                      editing && addressKeys.some((key) => key === field.id)
                        ? styles.addressField
                        : undefined
                    }
                  >
                    {editing && application.editableIds.includes(field.id) ? (
                      input(field)
                    ) : (
                      <dl>
                        <dt>{field.label}</dt>
                        <dd>{answer(field, details[field.id] ?? "")}</dd>
                      </dl>
                    )}
                    {editing &&
                      field.type === "document" &&
                      field.documentKind &&
                      field.step !== 4 &&
                      !/signature/i.test(field.id) &&
                      applicable(field, application.category) && (
                        <label className={styles.evidenceUpload}>
                          {details[field.id]
                            ? "Replace evidence"
                            : "Upload evidence"}
                          <input
                            type="file"
                            accept={
                              field.documentKind === "photograph"
                                ? "image/jpeg,image/png"
                                : "application/pdf,image/jpeg,image/png"
                            }
                            onChange={async (event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              if (!file) return;
                              const body = new FormData();
                              body.set("file", file);
                              body.set("kind", field.documentKind!);
                              body.set("fieldId", field.id);
                              body.set("memberUserId", userId);
                              body.set(
                                "applicationVersion",
                                String(application.version),
                              );
                              setUploading(true);
                              setMessage("Uploading evidence…");
                              try {
                                const response = await fetch("/api/documents", {
                                  method: "POST",
                                  body,
                                });
                                const result = await response.json();
                                if (!response.ok)
                                  throw Error(
                                    result.error ||
                                      "Could not upload evidence.",
                                  );
                                setApplication({
                                  ...application,
                                  version: application.version + 1,
                                  details: {
                                    ...application.details,
                                    [field.id]: result.id,
                                  },
                                });
                                setMessage(field.label + " uploaded.");
                              } catch (error) {
                                setMessage((error as Error).message);
                              } finally {
                                setUploading(false);
                              }
                            }}
                          />
                        </label>
                      )}
                  </div>
                ))}
              </section>
            )
          );
        })}
      </fieldset>
      {editing && (
        <button
          type="submit"
          className="button"
          disabled={saving || uploading || !Object.keys(changes).length}
        >
          Save onboarding details
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
