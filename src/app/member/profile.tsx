"use client";
import { useEffect, useState } from "react";
type DocumentRecord = {
  id: string;
  kind: string;
  byte_size: number;
  created_at: string;
};
export function MemberProfile({ storageEnabled }: { storageEnabled: boolean }) {
  const [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState({
    phone: "",
    organization: "",
    contactPreference: "email",
    newsletter: false,
  });
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [p, d] = await Promise.all([
          fetch("/api/member/profile"),
          fetch("/api/documents"),
        ]);
        if (!p.ok || !d.ok) throw new Error();
        const data = await p.json(),
          docs = await d.json();
        if (active) {
          setProfile({
            phone: data.phone ?? "",
            organization: data.organization ?? "",
            contactPreference: data.preferences?.contact ?? "email",
            newsletter: data.newsletter,
          });
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
  if (loading) return <p role="status">Loading your profile…</p>;
  if (loadError)
    return (
      <p role="alert">Unable to load your records. Refresh to try again.</p>
    );
  return (
    <div className="member-settings">
      <section>
        <h2>Your profile</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              const response = await fetch("/api/member/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(profile),
              });
              setMessage(
                response.ok
                  ? "Profile saved."
                  : "Unable to save. Check your details and try again.",
              );
            } catch {
              setMessage("Unable to connect. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Phone
            <input
              maxLength={32}
              type="tel"
              value={profile.phone}
              onChange={(e) =>
                setProfile({ ...profile, phone: e.target.value })
              }
            />
          </label>
          <label>
            Organization
            <input
              maxLength={200}
              value={profile.organization}
              onChange={(e) =>
                setProfile({ ...profile, organization: e.target.value })
              }
            />
          </label>
          <label>
            Contact preference
            <select
              value={profile.contactPreference}
              onChange={(e) =>
                setProfile({ ...profile, contactPreference: e.target.value })
              }
            >
              <option value="email">Email</option>
              <option value="none">No optional messages</option>
            </select>
          </label>
          <label className="consent">
            <input
              type="checkbox"
              checked={profile.newsletter}
              onChange={(e) =>
                setProfile({ ...profile, newsletter: e.target.checked })
              }
            />
            I consent to the TPA newsletter. I can withdraw this choice here at
            any time.
          </label>
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>
      <section>
        <h2>Private documents</h2>
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
              <option value="student_evidence">
                Student eligibility evidence
              </option>
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
            Upload document
          </button>
        </form>
        {documents.length === 0 ? (
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
        )}
      </section>
      <p role="status">{message}</p>
    </div>
  );
}
