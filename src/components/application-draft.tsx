"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./operations-client";
type Draft = {
  version: number;
  plan: string;
  category: string;
  details: Record<string, string>;
  documentIds: string[];
};
export function ApplicationDraft({ name }: { name: string }) {
  const [draft, setDraft] = useState<Draft>({
      version: 0,
      plan: "Annual",
      category: "Professional",
      details: { fullName: name },
      documentIds: [],
    }),
    [docs, setDocs] = useState<
      { id: string; kind: string; created_at: string }[]
    >([]),
    [message, setMessage] = useState("Loading your saved draft…"),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([
      api<Draft | null>("/api/member/application"),
      api<typeof docs>("/api/documents"),
      api<{ phone: string; organization: string }>("/api/member/profile"),
    ])
      .then(([saved, documents, profile]) => {
        if (saved) setDraft(saved);
        else
          setDraft((d) => ({
            ...d,
            details: {
              ...d.details,
              phone: profile.phone,
              organization: profile.organization,
            },
          }));
        setDocs(documents);
        setReady(true);
        setMessage("");
      })
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <>
      <div className="notice">
        You can save and resume your application. Submission and payment await
        approved fees, eligibility and declarations. This draft is private to
        you and is not under association review.
      </div>
      <form
        className="member-settings"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            setDraft(await api<Draft>("/api/member/application", draft));
            setMessage(
              "Draft saved. You can return to it from your member space.",
            );
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Save failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            Membership plan
            <select
              value={draft.plan}
              onChange={(e) => setDraft({ ...draft, plan: e.target.value })}
            >
              {["Annual", "Life", "Patron"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Applicant category
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              <option>Professional</option>
              <option>Student</option>
            </select>
          </label>
        </div>
        {(
          [
            ["fullName", "Full name"],
            ["phone", "Phone"],
            ["organization", "Organization"],
            [
              draft.category === "Student" ? "institution" : "qualification",
              draft.category === "Student"
                ? "Institution / course"
                : "Professional qualification",
            ],
            ["address", "Contact address"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={draft.details[key] ?? ""}
              maxLength={key === "address" ? 1000 : 200}
              autoComplete={
                key === "fullName" ? "name" : key === "phone" ? "tel" : "off"
              }
              onChange={(e) =>
                setDraft({
                  ...draft,
                  details: { ...draft.details, [key]: e.target.value },
                })
              }
            />
          </label>
        ))}
        <fieldset>
          <legend>Supporting documents</legend>
          <p>
            <Link href="/member">Upload private documents in your profile</Link>
            , then select them here.
          </p>
          {docs.length === 0 && <p>No private documents uploaded.</p>}
          {docs.map((doc) => (
            <label className="consent" key={doc.id}>
              <input
                type="checkbox"
                checked={draft.documentIds.includes(doc.id)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    documentIds: e.target.checked
                      ? [...draft.documentIds, doc.id]
                      : draft.documentIds.filter((id) => id !== doc.id),
                  })
                }
              />
              {doc.kind.replaceAll("_", " ")} ·{" "}
              {new Date(doc.created_at).toLocaleDateString("en-IN")}
            </label>
          ))}
        </fieldset>
        <button className="button" disabled={!ready || busy}>
          {busy ? "Saving…" : "Save application draft"}
        </button>
      </form>
      <p role="status">{message}</p>
    </>
  );
}
