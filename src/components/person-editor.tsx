"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { api } from "./operations-client";
import { RichEditor, TextCounter } from "./rich-editor";
import { ContentPreview } from "./content-preview";
import {
  PublicGovernance,
  type PublicGovernanceEntry,
} from "./public-governance";
import {
  PublicContentView,
  emptyContentContext,
  type PublicContentContext,
} from "./public-content-view";
import { sitePages } from "@/domain/site-pages";
import type { ContentBody } from "@/domain/operations";
import { RichContent } from "./rich-content";
import { peopleFallback } from "@/domain/people-placement";
import {
  emptyPerson,
  personBody,
  linkPlatforms,
  type PersonBody,
  type PersonEntry,
  type ProfileGroup,
} from "@/domain/people";
import { useUnsavedProfile } from "./use-unsaved-profile";
function normalized(p: PersonBody) {
  try {
    return JSON.stringify(personBody(p));
  } catch {
    return JSON.stringify(p);
  }
}
export function PersonEditor({
  entry,
  groups = [],
  editorial = [],
  owner = false,
  canReview = false,
  canPublish = false,
  canEditPrivate = false,
  onSaved,
  onDirty,
}: {
  entry: PersonEntry | null;
  groups?: ProfileGroup[];
  editorial?: { id: string; title: string }[];
  owner?: boolean;
  canReview?: boolean;
  canPublish?: boolean;
  canEditPrivate?: boolean;
  onSaved: (row: PersonEntry) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const [body, setBody] = useState<PersonBody>(entry?.draft ?? emptyPerson),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [panel, setPanel] = useState("edit"),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
    [userId, setUserId] = useState(""),
    [portraitData, setPortraitData] = useState<{
      uploadEnabled: boolean;
      portraits: { id: string; alt_text: string }[];
    }>({ uploadEnabled: false, portraits: [] }),
    [mode, setMode] = useState("card"),
    [placement, setPlacement] = useState(""),
    [context, setContext] = useState<PublicContentContext>(emptyContentContext),
    [publishedContent, setPublishedContent] = useState<ContentBody | null>(
      null,
    ),
    [contextError, setContextError] = useState("");
  const dirty = normalized(body) !== normalized(entry?.draft ?? emptyPerson);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  const { dialog } = useUnsavedProfile(dirty);
  let error = "";
  try {
    personBody(body);
  } catch (e) {
    error = (e as Error).message;
  }
  const group = groups.find(
    (g) => g.id === (placement || body.assignments[0]?.groupId),
  );
  const parent = group?.parent_id
    ? groups.find((g) => g.id === group.parent_id)
    : null;
  const page = (parent ?? group)?.draft.page ?? "governance",
    section = (parent ?? group)?.draft.section ?? 0;
  useEffect(() => {
    if (owner || mode !== "placement") return;
    let active = true;
    api<PublicContentContext & { pageContent: ContentBody | null }>(
      `/api/staff/governance/preview?page=${page}`,
    )
      .then((v) => {
        if (active) {
          setContext(v);
          setPublishedContent(v.pageContent);
          setContextError("");
        }
      })
      .catch(() => {
        if (active)
          setContextError("Unable to load current published inserts.");
      });
    return () => {
      active = false;
    };
  }, [page, mode, owner]);
  useEffect(() => {
    if (!entry?.id) return;
    let active = true;
    api<typeof portraitData>(`/api/profile-portraits?personId=${entry.id}`)
      .then((v) => {
        if (active) setPortraitData(v);
      })
      .catch(() => {
        if (active) setPortraitData({ uploadEnabled: false, portraits: [] });
      });
    return () => {
      active = false;
    };
  }, [entry?.id]);
  function field<K extends keyof PersonBody>(key: K, value: PersonBody[K]) {
    setBody((p) => ({ ...p, [key]: value }));
    setConfirm(false);
  }
  async function act(action: string, accountLink = userId || null) {
    setBusy(true);
    setMessage("");
    try {
      const personal: Partial<PersonBody> = { ...body };
      delete personal.assignments;
      const row = await api<PersonEntry>(
        ["approve", "reject"].includes(action)
          ? "/api/staff/profile-reviews"
          : owner
            ? "/api/member/profile"
            : "/api/staff/governance",
        {
          action,
          id: entry?.id,
          version: entry?.version ?? 0,
          body: owner ? personal : body,
          reviewId: entry?.reviews?.find((r) => r.status === "pending")?.id,
          reason,
          confirmPublication: confirm,
          userId: accountLink,
        },
      );
      onSaved(row);
      setBody(row.draft);
      setConfirm(false);
      setMessage(
        (
          {
            save: "Draft saved privately. It is not verified.",
            submit: "Submitted for administrator review.",
            approve:
              "Profile verified. Public publication is a separate action.",
            reject:
              "Proposal rejected. Previous accepted details are retained.",
            publish: "Approved profile published.",
            unpublish: "Public profile withdrawn.",
            link: "Account link updated.",
          } as Record<string, string>
        )[action] ?? "Saved.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const previewEntries: PublicGovernanceEntry[] = (
    body.assignments.length
      ? body.assignments
      : [{ groupId: "", role: "Personal profile preview", term: "", order: 0 }]
  ).map((a) => ({
    id: `${entry?.id ?? "new"}:${a.groupId}`,
    published: {
      ...body,
      role: a.role,
      term: a.term,
      order: a.order,
      groupName:
        groups.find((g) => g.id === a.groupId)?.draft.name ?? "Your profile",
      page,
      section,
    },
    portrait_available: !!body.portraitId,
    portrait_alt: body.name,
  }));
  const fallback = sitePages[page];
  const pageBody =
    publishedContent ??
    peopleFallback(
      page,
      {
        ...fallback,
        sourceUrl: "",
        attribution: "",
        sections: fallback.sections.map((s) => ({ ...s })),
      },
      [...context.people, ...previewEntries],
    );
  const rendered =
    mode === "placement" && !owner ? (
      <PublicContentView
        page={page}
        data={pageBody}
        readOnly
        context={{
          ...context,
          people: [
            ...context.people.filter((p) => !p.id.startsWith(`${entry?.id}:`)),
            ...previewEntries
              .filter((p) => p.id.endsWith(`:${group?.id}`))
              .map((p) => ({
                ...p,
                published: { ...p.published, page, section },
              })),
          ],
        }}
      />
    ) : (
      <main className="profile-preview-main">
        <span className="eyebrow">PROFILE PREVIEW</span>
        <PublicGovernance entries={previewEntries} />
      </main>
    );
  const pending = entry?.reviews?.find((r) => r.status === "pending");
  return (
    <>
      <div className="content-editor-heading">
        <div>
          <h2>{entry ? "Edit person" : "New person"}</h2>
          <p>
            Personal details, association assignments and public publication
            have separate approval steps.
          </p>
        </div>
        <span className="content-save-state">
          {dirty
            ? "Unsaved changes"
            : entry
              ? (
                  {
                    pending: "Pending review",
                    verified: "Verified",
                    rejected: "Rejected",
                    unverified: "Unverified",
                  } as Record<string, string>
                )[entry.status]
              : "New profile"}
        </span>
      </div>
      {entry?.published && (
        <p className="notice">
          The public site retains its last published snapshot while you edit.
        </p>
      )}
      <div
        className="content-mobile-tabs"
        role="tablist"
        aria-label="Profile workspace view"
      >
        {["edit", "preview"].map((v, i) => (
          <button
            key={v}
            role="tab"
            aria-selected={panel === v}
            aria-controls={`person-panel-${v}`}
            onClick={() => setPanel(v)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? "edit"
                    : e.key === "End"
                      ? "preview"
                      : i === 0
                        ? "preview"
                        : "edit";
                setPanel(next);
                (
                  e.currentTarget.parentElement?.children[
                    next === "edit" ? 0 : 1
                  ] as HTMLElement
                )?.focus();
              }
            }}
          >
            {v === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>
      <div className="content-editor-columns">
        <section
          id="person-panel-edit"
          className={`content-editor-panel ${panel === "edit" ? "mobile-active" : ""}`}
        >
          <form
            className="member-settings"
            onSubmit={(e) => {
              e.preventDefault();
              void act("save");
            }}
          >
            <fieldset className="plain-fieldset" disabled={busy}>
              <div className="form-grid">
                {(
                  [
                    ["name", "Display name", 120],
                    ["profession", "Professional title", 160],
                    ["organization", "Organization", 200],
                    ["jobTitle", "Job title", 120],
                    ["city", "City", 120],
                    ...(owner || canEditPrivate
                      ? [["phone", "Phone (private)", 32]]
                      : []),
                  ] as [keyof PersonBody, string, number][]
                ).map(([key, label, limit]) => (
                  <label key={key}>
                    {label}
                    <input
                      value={String(body[key] ?? "")}
                      required={key === "name"}
                      maxLength={limit}
                      onChange={(e) => field(key, e.target.value as never)}
                    />
                    <TextCounter
                      label={label}
                      value={String(body[key] ?? "")}
                      limit={limit}
                    />
                  </label>
                ))}
              </div>
              <label>
                Name size
                <select
                  value={body.nameSize ?? "body"}
                  onChange={(e) =>
                    field("nameSize", e.target.value as PersonBody["nameSize"])
                  }
                >
                  {["small", "body", "large", "display"].map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <h3>Biography</h3>
              <RichEditor
                label="Biography"
                document={body.biographyRich}
                text={body.biography}
                limit={20000}
                disabled={busy}
                onChange={(rich, text) =>
                  setBody((p) => ({
                    ...p,
                    biography: text,
                    biographyRich: rich,
                  }))
                }
              />
              <h3>Portrait</h3>
              <label>
                Portrait selection
                <select
                  value={
                    body.portraitId
                      ? `${body.portraitKind ?? "editorial"}:${body.portraitId}`
                      : ""
                  }
                  onChange={(e) => {
                    const [kind, id] = e.target.value.split(":");
                    setBody((p) => ({
                      ...p,
                      portraitId: id || null,
                      portraitKind: (kind ||
                        "editorial") as PersonBody["portraitKind"],
                    }));
                  }}
                >
                  <option value="">Use initials</option>
                  {editorial.map((p) => (
                    <option key={p.id} value={`editorial:${p.id}`}>
                      {p.title}
                    </option>
                  ))}
                  {portraitData.portraits.map((p) => (
                    <option key={p.id} value={`profile:${p.id}`}>
                      {p.alt_text}
                    </option>
                  ))}
                </select>
              </label>
              {!portraitData.uploadEnabled && (
                <p className="notice">
                  Hosted portrait upload awaits scoped private storage.
                  Available portraits can still be selected.
                </p>
              )}
              <label>
                Upload / replace portrait
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={!entry || !portraitData.uploadEnabled || busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !entry) return;
                    setBusy(true);
                    try {
                      const form = new FormData();
                      form.set("personId", entry.id);
                      form.set("altText", `Portrait of ${body.name}`);
                      form.set("file", file);
                      const res = await fetch("/api/profile-portraits", {
                        method: "POST",
                        body: form,
                      });
                      const value = await res.json();
                      if (!res.ok) throw Error(value.error);
                      setPortraitData(
                        await api(
                          `/api/profile-portraits?personId=${entry.id}`,
                        ),
                      );
                      setBody((p) => ({
                        ...p,
                        portraitId: value.id,
                        portraitKind: "profile",
                      }));
                      setMessage(
                        "Portrait uploaded privately. Save and submit your profile for review.",
                      );
                    } catch (err) {
                      setMessage((err as Error).message);
                    } finally {
                      setBusy(false);
                      e.target.value = "";
                    }
                  }}
                />
                <small>
                  Static JPEG/PNG up to 5 MB. Metadata is removed. Save a new
                  person before uploading.
                </small>
              </label>
              <h3>Social & portfolio links</h3>
              <p className="content-restrictions">
                Optional HTTPS URLs. Only links you select for public display
                appear after review and publication. Phone and email remain
                private.
              </p>
              {body.links.map((link, i) => (
                <fieldset key={i}>
                  <legend>Link {i + 1}</legend>
                  <label>
                    Platform
                    <select
                      value={link.platform}
                      onChange={(e) =>
                        field(
                          "links",
                          body.links.map((l, n) =>
                            n === i ? { ...l, platform: e.target.value } : l,
                          ),
                        )
                      }
                    >
                      {linkPlatforms.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  {(["label", "url"] as const).map((k) => (
                    <label key={k}>
                      {k === "url" ? "HTTPS URL" : "Link label"}
                      <input
                        value={link[k]}
                        maxLength={k === "url" ? 1000 : 60}
                        onChange={(e) =>
                          field(
                            "links",
                            body.links.map((l, n) =>
                              n === i ? { ...l, [k]: e.target.value } : l,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <label className="consent-row">
                    <input
                      type="checkbox"
                      checked={link.public}
                      onChange={(e) =>
                        field(
                          "links",
                          body.links.map((l, n) =>
                            n === i ? { ...l, public: e.target.checked } : l,
                          ),
                        )
                      }
                    />
                    Include on public profile
                  </label>
                  <div className="action-row">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => {
                        const links = [...body.links];
                        [links[i - 1], links[i]] = [links[i], links[i - 1]];
                        field("links", links);
                      }}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      disabled={i === body.links.length - 1}
                      onClick={() => {
                        const links = [...body.links];
                        [links[i + 1], links[i]] = [links[i], links[i + 1]];
                        field("links", links);
                      }}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        field(
                          "links",
                          body.links.filter((_, n) => n !== i),
                        )
                      }
                    >
                      Remove link {i + 1}
                    </button>
                  </div>
                </fieldset>
              ))}
              <button
                type="button"
                className="button secondary small"
                disabled={body.links.length >= 12}
                onClick={() =>
                  field("links", [
                    ...body.links,
                    {
                      platform: "Website",
                      label: "Website",
                      url: "",
                      public: false,
                    },
                  ])
                }
              >
                Add link ({body.links.length}/12)
              </button>
              {!owner && canPublish && (
                <>
                  <h3>Association assignments</h3>
                  {body.assignments.map((a, i) => (
                    <fieldset key={i}>
                      <legend>Assignment {i + 1}</legend>
                      <label>
                        Group / subgroup
                        <select
                          value={a.groupId}
                          onChange={(e) =>
                            field(
                              "assignments",
                              body.assignments.map((v, n) =>
                                n === i ? { ...v, groupId: e.target.value } : v,
                              ),
                            )
                          }
                        >
                          <option value="">Choose group</option>
                          {groups
                            .filter((g) => !g.archived)
                            .map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.parent_id
                                  ? `${groups.find((p) => p.id === g.parent_id)?.draft.name} / `
                                  : ""}
                                {g.draft.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      {(["role", "term", "label", "order"] as const).map(
                        (k) => (
                          <label key={k}>
                            {k === "role"
                              ? "Association role"
                              : k === "term"
                                ? "Term / year"
                                : k === "label"
                                  ? "Assignment label (optional)"
                                  : "Display order"}
                            <input
                              type={k === "order" ? "number" : "text"}
                              min={0}
                              max={999}
                              maxLength={k === "term" ? 80 : 120}
                              value={a[k] ?? ""}
                              onChange={(e) =>
                                field(
                                  "assignments",
                                  body.assignments.map((v, n) =>
                                    n === i
                                      ? {
                                          ...v,
                                          [k]:
                                            k === "order"
                                              ? Number(e.target.value)
                                              : e.target.value,
                                        }
                                      : v,
                                  ),
                                )
                              }
                            />
                          </label>
                        ),
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          field(
                            "assignments",
                            body.assignments.filter((_, n) => n !== i),
                          )
                        }
                      >
                        Remove assignment {i + 1}
                      </button>
                    </fieldset>
                  ))}
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={body.assignments.length >= 20}
                    onClick={() =>
                      field("assignments", [
                        ...body.assignments,
                        { groupId: "", role: "", term: "", order: 0 },
                      ])
                    }
                  >
                    Add assignment
                  </button>
                </>
              )}
              {error && <p role="status">{error}</p>}
              <div className="action-row">
                <button className="button" disabled={busy || !!error}>
                  Save private draft
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || dirty || !entry || !!error}
                  onClick={() => void act("submit")}
                >
                  Submit for review
                </button>
              </div>
            </fieldset>
          </form>
          {entry && (
            <>
              <section className="profile-review-status">
                <h3>Review & publication</h3>
                <p>
                  {entry.accepted_verified
                    ? "Previously accepted details are verified."
                    : "Existing details are unverified."}{" "}
                  {pending
                    ? "A proposal is waiting for administrator review."
                    : ""}
                </p>
                {entry.reviews?.[0]?.status === "rejected" && (
                  <p className="notice">Reason: {entry.reviews[0].reason}</p>
                )}
                {pending && (
                  <details open>
                    <summary>
                      Proposed changes ·{" "}
                      {new Date(pending.created_at).toLocaleString("en-IN")}
                    </summary>
                    <p>
                      Proposed by:{" "}
                      {pending.proposer_name ?? pending.proposed_by}
                    </p>
                    {!entry.accepted_verified && (
                      <p>
                        Review the full profile above. Its existing baseline has
                        not been verified.
                      </p>
                    )}
                    <dl className="profile-diff">
                      {(pending.body.portraitId !==
                        pending.baseline.portraitId ||
                        pending.body.portraitKind !==
                          pending.baseline.portraitKind) && (
                        <div>
                          <dt>Portrait comparison</dt>
                          <dd>
                            {[pending.baseline, pending.body].map((p, i) => (
                              <div key={i}>
                                <span>{i ? "Proposed" : "Previously"}</span>
                                {p.portraitId ? (
                                  <Image
                                    unoptimized
                                    src={
                                      p.portraitKind === "profile"
                                        ? `/api/profile-portraits/${p.portraitId}`
                                        : `/media/${p.portraitId}`
                                    }
                                    width={112}
                                    height={112}
                                    alt={`${i ? "Proposed" : "Previous"} portrait`}
                                  />
                                ) : (
                                  <p>No portrait</p>
                                )}
                              </div>
                            ))}
                          </dd>
                        </div>
                      )}
                      {JSON.stringify(pending.body.biographyRich) !==
                        JSON.stringify(pending.baseline.biographyRich) && (
                        <div>
                          <dt>Biography formatting</dt>
                          <dd>
                            <span>Previously</span>
                            <RichContent
                              document={pending.baseline.biographyRich}
                              text={pending.baseline.biography}
                            />
                            <span>Proposed</span>
                            <RichContent
                              document={pending.body.biographyRich}
                              text={pending.body.biography}
                            />
                          </dd>
                        </div>
                      )}
                      {Object.keys(pending.body)
                        .filter(
                          (k) =>
                            k !== "biographyRich" &&
                            JSON.stringify(
                              pending.body[k as keyof PersonBody],
                            ) !==
                              JSON.stringify(
                                pending.baseline[k as keyof PersonBody],
                              ),
                        )
                        .map((k) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>
                              <span>Previously</span>
                              <pre>
                                {typeof pending.baseline[
                                  k as keyof PersonBody
                                ] === "object"
                                  ? JSON.stringify(
                                      pending.baseline[k as keyof PersonBody],
                                      null,
                                      2,
                                    )
                                  : String(
                                      pending.baseline[k as keyof PersonBody] ??
                                        "—",
                                    )}
                              </pre>
                              <span>Proposed</span>
                              <pre>
                                {typeof pending.body[k as keyof PersonBody] ===
                                "object"
                                  ? JSON.stringify(
                                      pending.body[k as keyof PersonBody],
                                      null,
                                      2,
                                    )
                                  : String(
                                      pending.body[k as keyof PersonBody] ??
                                        "—",
                                    )}
                              </pre>
                            </dd>
                          </div>
                        ))}
                    </dl>
                    {canReview && (
                      <>
                        <label>
                          Review / rejection reason
                          <textarea
                            value={reason}
                            maxLength={2000}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        </label>
                        <div className="action-row">
                          <button
                            className="button"
                            disabled={busy || dirty}
                            onClick={() => void act("approve")}
                          >
                            Approve reviewed details
                          </button>
                          <button
                            className="button secondary"
                            disabled={busy || dirty || !reason.trim()}
                            onClick={() => void act("reject")}
                          >
                            Reject proposal
                          </button>
                        </div>
                      </>
                    )}
                  </details>
                )}
                {canPublish && (
                  <>
                    <label className="consent-row">
                      <input
                        type="checkbox"
                        checked={confirm}
                        onChange={(e) => setConfirm(e.target.checked)}
                      />
                      I confirm permission to publish this approved profile and
                      portrait.
                    </label>
                    <div className="action-row">
                      <button
                        className="button"
                        disabled={
                          busy ||
                          dirty ||
                          !confirm ||
                          entry.status !== "verified"
                        }
                        onClick={() => void act("publish")}
                      >
                        Publish verified profile
                      </button>
                      <button
                        className="button secondary"
                        disabled={busy || dirty || !entry.published}
                        onClick={() => void act("unpublish")}
                      >
                        Withdraw public profile
                      </button>
                    </div>
                  </>
                )}
                {canReview && !owner && (
                  <details>
                    <summary>Account ownership</summary>
                    <p>
                      Linked account: {entry.user_id ?? "None"}. Linking does
                      not approve membership or grant roles.
                    </p>
                    <label>
                      Authentication account ID
                      <input
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                      />
                    </label>
                    <button
                      className="button secondary"
                      disabled={busy || dirty || !userId}
                      onClick={() => void act("link")}
                    >
                      Link account
                    </button>
                    {entry.user_id && (
                      <button
                        className="button secondary"
                        disabled={busy || dirty}
                        onClick={() => {
                          setUserId("");
                          void act("link", null);
                        }}
                      >
                        Unlink account
                      </button>
                    )}
                  </details>
                )}
                <details>
                  <summary>Revision and review history</summary>
                  {entry.history?.map((h) => (
                    <p key={h.id}>
                      Version {h.version} · {h.action} ·{" "}
                      {new Date(h.created_at).toLocaleString("en-IN")}
                    </p>
                  ))}
                  {entry.reviews?.map((r) => (
                    <p key={r.id}>
                      {r.status} ·{" "}
                      {new Date(r.created_at).toLocaleString("en-IN")}{" "}
                      {r.reason}
                    </p>
                  ))}
                </details>
              </section>
            </>
          )}
          <p role="status">{message}</p>
        </section>
        <div
          id="person-panel-preview"
          className={`content-preview-panel ${panel === "preview" ? "mobile-active" : ""}`}
        >
          {!owner && (
            <div className="profile-preview-controls">
              <label>
                Preview view
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="card">Profile cards</option>
                  <option value="placement">Website placement</option>
                </select>
              </label>
              {mode === "placement" && (
                <label>
                  Preview assignment
                  <select
                    value={placement || body.assignments[0]?.groupId || ""}
                    onChange={(e) => setPlacement(e.target.value)}
                  >
                    {body.assignments.map((a) => (
                      <option key={a.groupId} value={a.groupId}>
                        {groups.find((g) => g.id === a.groupId)?.draft.name ??
                          "Choose a group"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          <ContentPreview
            body={pageBody}
            kind="page"
            slug={page}
            context={context}
            dirty={dirty}
            isNew={!entry}
            contextLoading={false}
            contextError={contextError}
            onRetry={() => {
              setMode("card");
              setContextError("");
            }}
            rendered={rendered}
          />
        </div>
      </div>
      {dialog}
    </>
  );
}
