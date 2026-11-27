"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api } from "./operations-client";
import { GovernanceContacts } from "./governance-card";
import { RichContent } from "./rich-content";
import { StatusBadge } from "./portal-values";
import { useUnsavedProfile } from "./use-unsaved-profile";
import {
  emptyPerson,
  personBody,
  editorialProfileFields,
  type PersonBody,
  type PersonEntry,
} from "@/domain/people";
import { publicProfilePatch } from "@/domain/publishing";
import type { PublishingMembersData } from "./publishing-members";
import ui from "./communications.module.css";
import styles from "./publishing.module.css";
export function PublicProfileEditor({
  initial,
  data,
  onDirty,
  onClose,
}: {
  initial: PersonEntry | null;
  data: PublishingMembersData;
  onDirty?: (dirty: boolean) => void;
  onClose: () => void;
}) {
  const [entry, setEntry] = useState(initial),
    [body, setBody] = useState<PersonBody>(initial?.draft ?? emptyPerson),
    [mode, setMode] = useState("edit"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [portraits, setPortraits] = useState<{
      uploadEnabled: boolean;
      portraits: { id: string; alt_text: string }[];
    }>({ uploadEnabled: false, portraits: [] });
  const dirty =
      JSON.stringify(publicProfilePatch(body)) !==
      JSON.stringify(publicProfilePatch(entry?.draft ?? emptyPerson)),
    { guard, dialog } = useUnsavedProfile(dirty, false);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!entry?.id) return;
    api<typeof portraits>(`/api/profile-portraits?personId=${entry.id}`)
      .then(setPortraits)
      .catch(() => {});
  }, [entry?.id]);
  function edit(patch: Partial<PersonBody>) {
    setBody((b) => ({ ...b, ...patch }));
    setConfirmed(false);
    setNotice("");
  }
  let validation = !body.name.trim()
    ? "Add a display name."
    : body.assignments.some((a) => !a.groupId)
      ? "Choose a website group for each placement."
      : body.assignments.some((a) => a.role.trim().length < 2)
        ? "Add an association role for each placement."
        : "";
  if (!validation)
    try {
      personBody(body);
    } catch (e) {
      validation = (e as Error).message;
    }
  const publicEmail = body.publicEmail ?? initial?.websiteContacts?.email ?? "";
  const publicMobile = body.publicMobile ?? initial?.websiteContacts?.mobile ?? "";
  const pending = entry?.reviews?.find((r) => r.status === "pending");
  const needsMemberReview =
    entry &&
    [
      ...new Set([...Object.keys(entry.draft), ...Object.keys(entry.accepted)]),
    ].some(
      (k) =>
        !editorialProfileFields.has(k) &&
        JSON.stringify(entry.draft[k as keyof PersonBody]) !==
          JSON.stringify(entry.accepted[k as keyof PersonBody]),
    );
  const savedMatches =
    !!entry && JSON.stringify(entry.draft) === JSON.stringify(entry.accepted);
  const canPublishSaved =
    savedMatches &&
    ((entry?.accepted_verified && entry.status === "verified") ||
      entry?.reviews?.some((r) => r.status === "approved"));
  const locked = busy || !!entry?.archived_at || !data.canPublish;
  async function action(action: string) {
    setBusy(true);
    setError("");
    try {
      const row = await api<PersonEntry>(
        action === "approve_editorial"
          ? "/api/staff/profile-reviews"
          : "/api/staff/governance",
        {
          action,
          id: entry?.id,
          version: entry?.version ?? 0,
          ...(action === "save" ? { body: publicProfilePatch(body) } : {}),
          reviewId: pending?.id,
          reason,
          confirmPublication: confirmed,
        },
      );
      if (action === "delete-public-profile") {
        onClose();
        return;
      }
      setEntry(row);
      setBody(row.draft);
      setConfirmed(false);
      setReason("");
      onDirty?.(false);
      setNotice(
        action === "save"
          ? "Profile draft saved. Submit it for review when ready."
          : action === "submit"
            ? "Saved profile submitted for review."
            : action === "approve_editorial"
              ? "Public profile approved. You can now publish it."
              : action === "publish"
                ? "Profile published on the website."
                : action === "unpublish"
                  ? "Profile removed from the website."
                  : `Profile ${action} completed.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Public member profile editor">
      <button
        className={`text-button ${ui.back}`}
        disabled={busy}
        onClick={() => guard(onClose)}
      >
         Member profiles
      </button>
      <header className={ui.composerHeader}>
        <div>
          <h2>{entry ? body.name : "New website profile"}</h2>
          <p>
            {dirty
              ? "Unsaved changes"
              : "Edit the information shown on your website."}
          </p>
        </div>
        <div className={ui.headerActions}>
          {entry && data.canPublish && (
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Delete the website profile for ${entry.draft.name}? It will be removed from Publishing and the public website. Any linked membership and login will be kept.`))
                  void action("delete-public-profile");
              }}
            >
              Delete website profile
            </button>
          )}
          <button
            className="button secondary"
            disabled={locked || !!validation || (!dirty && !!entry)}
            onClick={() => void action("save")}
          >
            {busy ? "Working…" : "Save draft"}
          </button>
          <button
            className="button gold"
            disabled={
              locked ||
              dirty ||
              !entry ||
              !!validation ||
              entry.status === "pending" ||
              !!canPublishSaved
            }
            onClick={() => void action("submit")}
          >
            Submit for review
          </button>
        </div>
      </header>
      {error && (
        <p className={ui.notice} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={ui.notice} role="status">
          {notice}
        </p>
      )}
      <div className={ui.toolbar}>
        <div className={ui.tabs} role="group" aria-label="Profile view">
          {["edit", "preview"].map((v) => (
            <button
              className="text-button"
              aria-pressed={mode === v}
              key={v}
              onClick={() => setMode(v)}
            >
              {v === "edit" ? "Edit profile" : "Website preview"}
            </button>
          ))}
        </div>
        <StatusBadge
          tone={entry?.published ? "success" : pending ? "pending" : "neutral"}
        >
          {entry?.archived_at
            ? "Archived"
            : entry?.published
              ? "Published"
              : pending
                ? "Awaiting review"
                : canPublishSaved
                  ? "Ready to publish"
                  : "Draft"}
        </StatusBadge>
      </div>
      <div className={styles.editorLayout}>
        <div>
          {mode === "edit" ? (
            <form
              className={styles.writing}
              onSubmit={(e) => {
                e.preventDefault();
                if (!validation) void action("save");
              }}
            >
              <fieldset disabled={locked}>
                <label>
                  Display name
                  <input
                    value={body.name}
                    maxLength={120}
                    minLength={2}
                    required
                    onChange={(e) => edit({ name: e.target.value })}
                  />
                </label>
                <label>
                  Designation
                  <input
                    value={body.publicDesignation ?? body.assignments[0]?.role ?? body.jobTitle}
                    maxLength={120}
                    onChange={(e) => edit({ publicDesignation: e.target.value })}
                  />
                </label>
                <div className={styles.row}>
                  <label>
                    Email
                    <input
                      type="email"
                      autoComplete="email"
                      value={publicEmail}
                      maxLength={254}
                      onChange={(e) => edit({ publicEmail: e.target.value })}
                    />
                  </label>
                  <label>
                    Mobile
                    <input
                      type="tel"
                      autoComplete="tel"
                      value={publicMobile}
                      maxLength={32}
                      onChange={(e) => edit({ publicMobile: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  About
                  <textarea
                    value={body.biography}
                    rows={7}
                    maxLength={20000}
                    onChange={(e) => edit({ biography: e.target.value, biographyRich: undefined })}
                  />
                </label>
              </fieldset>
            </form>
          ) : (
            <div
              className={`${styles.preview} ${styles.profilePreview}`}
              aria-label="Website profile preview"
            >
              {body.portraitId ? (
                <Image
                  unoptimized
                  className={styles.avatar}
                  src={
                    body.portraitKind === "profile"
                      ? `/api/profile-portraits/${body.portraitId}`
                      : `/media/${body.portraitId}`
                  }
                  width={88}
                  height={88}
                  alt={body.name}
                />
              ) : (
                <div className={styles.avatar} aria-hidden="true">
                  {body.name.slice(0, 1) || "?"}
                </div>
              )}
              <h3>{body.name || "Member name"}</h3>
              {body.publicDesignation ? <p>{body.publicDesignation}</p> : body.assignments.map((a) => (
                <p key={a.groupId}>
                  {a.role}
                  {a.term ? ` · ${a.term}` : ""}
                </p>
              ))}
              <p>
                {[body.profession, body.organization, body.city]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {(publicEmail || publicMobile) && (
                <GovernanceContacts name={body.name} mobile={publicMobile} email={publicEmail} />
              )}
              <div className={styles.biography}>
                <RichContent
                  document={body.biographyRich}
                  text={body.biography}
                />
              </div>
              {body.links
                .filter((l) => l.public)
                .map((l) => (
                  <p key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  </p>
                ))}
            </div>
          )}
        </div>
        <aside className={styles.settings}>
          <section>
            <h3>Profile photo</h3>
            {body.portraitId && (
              <Image
                unoptimized
                className={styles.avatar}
                src={
                  body.portraitKind === "profile"
                    ? `/api/profile-portraits/${body.portraitId}`
                    : `/media/${body.portraitId}`
                }
                width={88}
                height={88}
                alt={body.name}
              />
            )}
            <label>
              Choose photo
              <select
                disabled={locked}
                value={
                  body.portraitId
                    ? `${body.portraitKind}:${body.portraitId}`
                    : ""
                }
                onChange={(e) => {
                  const [portraitKind, portraitId] = e.target.value.split(":");
                  edit({
                    portraitKind: (portraitKind ||
                      "editorial") as PersonBody["portraitKind"],
                    portraitId: portraitId || null,
                  });
                }}
              >
                <option value="">No photo</option>
                {portraits.portraits.map((p) => (
                  <option key={p.id} value={`profile:${p.id}`}>
                    {p.alt_text || "Uploaded portrait"}
                  </option>
                ))}
                {data.portraits.map((p) => (
                  <option key={p.id} value={`editorial:${p.id}`}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Upload a photo
              <input
                type="file"
                accept="image/jpeg,image/png"
                disabled={locked || !entry || !portraits.uploadEnabled}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !entry) return;
                  setBusy(true);
                  setError("");
                  try {
                    const form = new FormData();
                    form.set("personId", entry.id);
                    form.set("altText", `Portrait of ${body.name}`);
                    form.set("file", file);
                    const res = await fetch("/api/profile-portraits", {
                      method: "POST",
                      body: form,
                    });
                    const result = await res.json();
                    if (!res.ok) throw Error(result.error);
                    setPortraits(
                      await api(`/api/profile-portraits?personId=${entry.id}`),
                    );
                    edit({ portraitId: result.id, portraitKind: "profile" });
                    setNotice(
                      "Photo uploaded. Save the profile to keep this selection.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
            <p>
              {!entry
                ? "Save the profile before uploading a photo."
                : "JPEG or PNG, up to 5 MB. Published after profile review."}
            </p>
          </section>
          <section>
            <h3>Review & publication</h3>
            {pending ? (
              <>
                <p>
                  A saved profile is awaiting review. Check the website preview
                  before approving it.
                </p>
                {needsMemberReview ? (
                  <p>
                    Name or member details changed and need administrator review before publishing.
                    {data.canReview && (
                      <>
                        {" "}<Link href="/admin?review=profile-reviews">Open profile reviews</Link>
                      </>
                    )}
                  </p>
                ) : data.canReview ? (
                  <>
                    <label>
                      Review note
                      <textarea
                        disabled={busy || dirty}
                        rows={3}
                        maxLength={2000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <button
                      className="button secondary"
                      disabled={busy || dirty || !reason.trim()}
                      onClick={() => {
                        setMode("preview");
                        void action("approve_editorial");
                      }}
                    >
                      Approve public profile
                    </button>
                    <p>
                      This approves website presentation. Membership
                      verification is managed separately.
                    </p>
                  </>
                ) : (
                  <p>An administrator needs to approve these changes.</p>
                )}
              </>
            ) : (
              <p>
                {canPublishSaved
                  ? "This public profile is approved. Confirm permission below, then publish it when ready."
                  : "Save the profile, submit it for review, then publish the approved version."}
              </p>
            )}
            {data.canPublish && entry && (
              <>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    disabled={dirty || busy}
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  I have permission to publish this profile and photo.
                </label>
                <button
                  className="button gold"
                  disabled={
                    busy ||
                    dirty ||
                    !confirmed ||
                    !body.assignments.length ||
                    !canPublishSaved ||
                    !!pending ||
                    !!entry.archived_at
                  }
                  onClick={() => void action("publish")}
                >
                  Publish profile
                </button>
                {entry.published && (
                  <button
                    className="button secondary"
                    disabled={busy || dirty}
                    onClick={() => void action("unpublish")}
                  >
                    Unpublish profile
                  </button>
                )}
              </>
            )}
            {entry && !entry.archived_at && !body.assignments.length && (
              <p>Choose a website group in Member profiles before publishing.</p>
            )}
            {validation && <p>{validation}</p>}
          </section>
          {entry && (
            <section>
              <details>
                <summary>Archive & history</summary>
                <p>
                  Archiving removes this profile from the website. Its member
                  record is retained.
                </p>
                <button
                  className="button secondary"
                  disabled={busy || dirty || !data.canPublish}
                  onClick={() =>
                    void action(entry.archived_at ? "restore" : "archive")
                  }
                >
                  {entry.archived_at ? "Restore profile" : "Archive profile"}
                </button>
                {entry.history?.slice(0, 8).map((h) => (
                  <p key={h.id}>
                    Version {h.version} · {h.action.replaceAll("_", " ")}
                  </p>
                ))}
              </details>
            </section>
          )}
        </aside>
      </div>
      {dialog}
    </section>
  );
}
