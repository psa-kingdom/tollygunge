"use client";
import { useEffect, useState } from "react";
import { PersonEditor } from "./person-editor";
import { api } from "./operations-client";
import type { PersonEntry } from "@/domain/people";
export function PersonalProfile() {
  const [entry, setEntry] = useState<PersonEntry>(),
    [message, setMessage] = useState("Loading your profile…"),
    [newsletter, setNewsletter] = useState(false),
    [contact, setContact] = useState("email"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api<{
      person: PersonEntry;
      newsletter: boolean;
      preferences: { contact: string };
    }>("/api/member/profile")
      .then((d) => {
        if (active) {
          setEntry(d.person);
          setNewsletter(d.newsletter);
          setContact(d.preferences.contact);
          setMessage("");
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section>
      <h2>Your personal profile</h2>
      <p>
        Save and submit changes for administrator review. Public details remain
        unchanged until verified and explicitly published. Your phone is
        private.
      </p>
      {entry && (
        <PersonEditor entry={entry} owner canEditPrivate onSaved={setEntry} />
      )}
      <form
        className="member-settings"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/api/member/profile", {
              action: "preferences",
              newsletter,
              contactPreference: contact,
            });
            setMessage("Communication preferences saved immediately.");
          } catch (err) {
            setMessage((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>Communication preferences</h3>
        <p>
          These choices take effect immediately and do not wait for profile
          review.
        </p>
        <label>
          Contact preference
          <select value={contact} onChange={(e) => setContact(e.target.value)}>
            <option value="email">Email</option>
            <option value="none">No optional messages</option>
          </select>
        </label>
        <label className="consent-row">
          <input
            type="checkbox"
            checked={newsletter}
            onChange={(e) => setNewsletter(e.target.checked)}
          />
          I consent to the TPA newsletter. I may withdraw at any time.
        </label>
        <button className="button secondary" disabled={busy}>
          Save communication preferences
        </button>
      </form>
      <p role="status">{message}</p>
    </section>
  );
}
