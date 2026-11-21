"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api } from "./operations-client";
import { RichEditor } from "./rich-editor";
import { RichContent } from "./rich-content";
import { StatusBadge } from "./portal-values";
import { useUnsavedProfile } from "./use-unsaved-profile";
import {
  emptyPerson,
  personBody,
  linkPlatforms,
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
    [placementOpen, setPlacementOpen] = useState(
      !initial?.draft.assignments.length,
    ),
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
  const pending = entry?.reviews?.find((r) => r.status === "pending");
  const editorialKeys = new Set([
    "biography",
    "biographyRich",
    "biographyTitle",
    "portraitId",
    "portraitKind",
    "assignments",
    "nameSize",
  ]);
  const needsMemberReview =
    entry &&
    [
      ...new Set([...Object.keys(entry.draft), ...Object.keys(entry.accepted)]),
    ].some(
      (k) =>
        !editorialKeys.has(k) &&
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
        ← Member profiles
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
                <div className={styles.row}>
                  <label>
                    Professional title
                    <input
                      value={body.profession}
                      maxLength={160}
                      onChange={(e) => edit({ profession: e.target.value })}
                    />
                  </label>
                  <label>
                    Organisation
                    <input
                      value={body.organization}
                      maxLength={200}
                      onChange={(e) => edit({ organization: e.target.value })}
                    />
                  </label>
                </div>
                <h3>Biography</h3>
                <RichEditor
                  compact
                  label="Biography"
                  document={body.biographyRich}
                  text={body.biography}
                  limit={20000}
                  disabled={locked}
                  onChange={(biographyRich, biography) =>
                    edit({ biographyRich, biography })
                  }
                />
                <details className={styles.placement}>
                  <summary>Additional profile details</summary>
                  <div className={styles.row}>
                    <label>
                      Designation / job title
                      <input
                        value={body.jobTitle}
                        maxLength={120}
                        onChange={(e) => edit({ jobTitle: e.target.value })}
                      />
                    </label>
                    <label>
                      City
                      <input
                        value={body.city}
                        maxLength={120}
                        onChange={(e) => edit({ city: e.target.value })}
                      />
                    </label>
                  </div>
                </details>
                <details
                  className={styles.placement}
                  open={placementOpen}
                  onToggle={(e) => setPlacementOpen(e.currentTarget.open)}
                >
                  <summary>
                    Website placement ·{" "}
                    {body.assignments.length
                      ? `${body.assignments.length} ${body.assignments.length === 1 ? "group" : "groups"}`
                      : "Choose a group"}
                  </summary>
                  <p className={styles.notice}>
                    Place this profile in a published About or Governance group.
                  </p>
                  {body.assignments.map((a, i) => (
                    <fieldset key={i}>
                      <legend>Placement {i + 1}</legend>
                      <label>
                        Website group
                        <select
                          value={a.groupId}
                          onChange={(e) =>
                            edit({
                              assignments: body.assignments.map((v, n) =>
                                n === i ? { ...v, groupId: e.target.value } : v,
                              ),
                            })
                          }
                        >
                          <option value="">Choose a group</option>
                          {data.groups
                            .filter((g) => !g.archived)
                            .map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.draft.name}
                                {!g.published ? " · Draft group" : ""}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Association role
                        <input
                          value={a.role}
                          maxLength={120}
                          onChange={(e) =>
                            edit({
                              assignments: body.assignments.map((v, n) =>
                                n === i ? { ...v, role: e.target.value } : v,
                              ),
                            })
                          }
                        />
                      </label>
                      <details className={styles.placement}>
                        <summary>Term & display order</summary>
                        <label>
                          Term / year
                          <input
                            value={a.term}
                            maxLength={80}
                            onChange={(e) =>
                              edit({
                                assignments: body.assignments.map((v, n) =>
                                  n === i ? { ...v, term: e.target.value } : v,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          Display order
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={a.order}
                            onChange={(e) =>
                              edit({
                                assignments: body.assignments.map((v, n) =>
                                  n === i
                                    ? { ...v, order: Number(e.target.value) }
                                    : v,
                                ),
                              })
                            }
                          />
                        </label>
                      </details>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() =>
                          edit({
                            assignments: body.assignments.filter(
                              (_, n) => n !== i,
                            ),
                          })
                        }
                      >
                        Remove placement
                      </button>
                    </fieldset>
                  ))}
                  <button
                    className="button secondary"
                    type="button"
                    disabled={body.assignments.length >= 20}
                    onClick={() =>
                      edit({
                        assignments: [
                          ...body.assignments,
                          { groupId: "", role: "", term: "", order: 0 },
                        ],
                      })
                    }
                  >
                    ＋ Add placement
                  </button>
                </details>
                <details className={styles.placement}>
                  <summary>Public links · {body.links.length}</summary>
                  {body.links.map((link, i) => (
                    <fieldset key={i}>
                      <legend>Link {i + 1}</legend>
                      <label>
                        Platform
                        <select
                          value={link.platform}
                          onChange={(e) =>
                            edit({
                              links: body.links.map((v, n) =>
                                n === i
                                  ? {
                                      ...v,
                                      platform: e.target.value,
                                      label: e.target.value,
                                    }
                                  : v,
                              ),
                            })
                          }
                        >
                          {linkPlatforms.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Website address
                        <input
                          type="url"
                          value={link.url}
                          maxLength={1000}
                          placeholder="https://"
                          onChange={(e) =>
                            edit({
                              links: body.links.map((v, n) =>
                                n === i ? { ...v, url: e.target.value } : v,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className={styles.check}>
                        <input
                          type="checkbox"
                          checked={link.public}
                          onChange={(e) =>
                            edit({
                              links: body.links.map((v, n) =>
                                n === i
                                  ? { ...v, public: e.target.checked }
                                  : v,
                              ),
                            })
                          }
                        />
                        Show on the website
                      </label>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() =>
                          edit({ links: body.links.filter((_, n) => n !== i) })
                        }
                      >
                        Remove link
                      </button>
                    </fieldset>
                  ))}
                  <button
                    className="button secondary"
                    type="button"
                    disabled={body.links.length >= 12}
                    onClick={() =>
                      edit({
                        links: [
                          ...body.links,
                          {
                            platform: "Website",
                            label: "Website",
                            url: "",
                            public: true,
                          },
                        ],
                      })
                    }
                  >
                    ＋ Add link
                  </button>
                </details>
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
              {body.assignments.map((a) => (
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
                      {l.label} ↗
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
                    Name or member details changed.{" "}
                    <Link href={`/admin/workspaces/governance?id=${entry!.id}`}>
                      Open member review
                    </Link>{" "}
                    before publishing.
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
