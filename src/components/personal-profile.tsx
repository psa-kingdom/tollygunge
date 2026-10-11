"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PersonEditor } from "./person-editor";
import { api } from "./operations-client";
import type { PersonEntry } from "@/domain/people";
export function PersonalProfile({ email }: { email: string }) {
  const [entry, setEntry] = useState<PersonEntry>(),
    [message, setMessage] = useState("Loading your profile…"),
    [newsletter, setNewsletter] = useState(false),
    [contact, setContact] = useState("email"),
    [onboardingDetails, setOnboardingDetails] = useState(false),
    [verificationRequired, setVerificationRequired] = useState(false),
    [busy, setBusy] = useState(false),
    [addresses, setAddresses] = useState<Record<string, string>>({}),
    [addressError, setAddressError] = useState(false),
    [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    api<{
      person: PersonEntry;
      verificationRequired?: boolean;
      onboardingDetails?: boolean;
      newsletter: boolean;
      preferences: { contact: string };
    }>("/api/member/profile")
      .then((d) => {
        if (active) {
          setEntry(d.person);
          setOnboardingDetails(!!d.onboardingDetails);
          setVerificationRequired(!!d.verificationRequired);
          setNewsletter(d.newsletter);
          setContact(d.preferences.contact);
          setMessage("");
        }
      })
      .catch((e) => {
        if (active) {
          setMessage(e.message);
          setLoadError(true);
        }
      });
    api<{ details?: Record<string, string> } | null>("/api/member/application")
      .then((d) => {
        if (active) setAddresses(d?.details || {});
      })
      .catch(() => {
        if (active) setAddressError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!entry)
    return (
      <section className="member-card" aria-label="Profile loading">
        <p role={loadError ? "alert" : "status"}>{message}</p>
        {loadError && (
          <button
            className="button secondary"
            onClick={() => window.location.reload()}
          >
            Retry loading profile
          </button>
        )}
      </section>
    );
  return (
    <section className="personal-profile">
      {!entry && <p role="status">{message}</p>}
      {entry && (
        <PersonEditor
          entry={entry}
          verificationRequired={verificationRequired}
          onboardingDetails={onboardingDetails}
          owner
          accountEmail={email}
          canEditPrivate
          onSaved={setEntry}
        />
      )}
      <form
        className="member-settings member-card profile-support-card"
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
      <section className="member-card profile-support-card">
        <div className="form-section-heading">
          <h3>Address & verification</h3>
          <p>
            Office and residential addresses are private and reviewed with your
            verification details.
          </p>
        </div>
        {addressError ? (
          <p role="alert">
            Address summary is unavailable. Open verification to retry.
          </p>
        ) : (
          <dl className="private-address-summary">
            <div>
              <dt>Office</dt>
              <dd>{addresses.officeAddress || "No office address saved"}</dd>
            </div>
            <div>
              <dt>Residence</dt>
              <dd>
                {addresses.residenceAddress || "No residential address saved"}
              </dd>
            </div>
          </dl>
        )}
        <Link href="/member/application" className="button secondary">
          Manage verification & addresses
        </Link>
      </section>
      <p role="status">{message}</p>
    </section>
  );
}
