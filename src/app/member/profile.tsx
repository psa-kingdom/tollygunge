"use client";
import { useEffect, useState } from "react";
import { PersonalProfile } from "@/components/personal-profile";
type DocumentRecord = {
  id: string;
  kind: string;
  byte_size: number;
  created_at: string;
};
export function MemberProfile({
  storageEnabled,
  email,
}: {
  storageEnabled: boolean;
  email: string;
}) {
  const [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await fetch("/api/documents");
        if (!d.ok) throw new Error();
        const docs = await d.json();
        if (active) {
          setDocuments(docs);
        }
      } catch {
        if (active) setLoadError(true);
        if (active)
          setMessage("Unable to load your records. Refresh to try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="member-profile-content">
      <PersonalProfile email={email} />
      <section className="member-card profile-support-card">
        <h2>Private documents</h2>
        {loading && <p role="status">Loading your documents…</p>}
        {loadError && (
          <p role="alert">
            Unable to load your documents.{" "}
            <button
              className="text-button"
              onClick={() => window.location.reload()}
            >
              Reload documents
            </button>
          </p>
        )}
        {!storageEnabled && (
          <p className="notice">
            Private uploads and downloads are being configured. Existing records
            remain visible.
          </p>
        )}
        <p>
          PDF, JPEG or PNG, up to 5 MB. Only you and authorized membership
          reviewers can access these files.
        </p>
        <form
          className="form-grid document-upload-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            setMessage("");
            try {
              const response = await fetch("/api/documents", {
                method: "POST",
                body: new FormData(form),
              });
              const result = await response.json();
              if (!response.ok) {
                setMessage(result.error);
                return;
              }
              const list = await fetch("/api/documents");
              if (!list.ok) throw new Error();
              setDocuments(await list.json());
              form.reset();
              setMessage("Document uploaded privately.");
            } catch {
              setMessage("Upload could not complete. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Document category
            <select name="kind">
              <option value="certificate">Professional certificate</option>
              <option value="photograph">Photograph</option>
            </select>
          </label>
          <label>
            File
            <input
              type="file"
              name="file"
              accept="application/pdf,image/jpeg,image/png"
              required
            />
          </label>
          <button
            className="button secondary"
            disabled={busy || !storageEnabled}
          >
            {busy ? "Uploading…" : "Upload document"}
          </button>
        </form>
        {!loading &&
          !loadError &&
          (documents.length === 0 ? (
            <p>No documents uploaded yet.</p>
          ) : (
            <ul>
              {documents.map((d) => (
                <li key={d.id}>
                  <a href={`/api/documents/${d.id}`}>
                    {d.kind.replaceAll("_", " ")} ·{" "}
                    {Math.ceil(d.byte_size / 1024)} KB
                  </a>
                </li>
              ))}
            </ul>
          ))}
      </section>
      <p role="status">{message}</p>
    </div>
  );
}
