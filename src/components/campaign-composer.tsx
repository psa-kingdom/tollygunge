"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./operations-client";
import { useEmailEditGuard } from "./email-edit-guard";
import { EmailMessagePreview } from "./email-message-preview";
import { StatusBadge } from "./portal-values";
import type { EmailReadiness } from "./email-deliveries";
import {
  audienceLabel,
  canSaveCampaign,
  emptyCampaign,
  type CampaignEntry,
  type EmailTemplate,
} from "@/domain/communications-ui";
import styles from "./communications.module.css";
type AudiencePreview = {
  matched: number;
  eligible: number;
  unsubscribed: number;
  unverified: number;
  preference_blocked: number;
  as_of: string;
  sample: { name: string; email: string }[];
};
type Review = {
  campaign: CampaignEntry;
  eligible: number;
  sample: { name: string; email: string }[];
  reviewToken: string;
  readiness: EmailReadiness;
};
type Dispatch = {
  id: string;
  version: number;
  created_at: string;
  cancelled_at: string | null;
  total: number;
  queued: number;
  accepted: number;
};
type Revision = {
  version: number;
  created_at: string;
  actor_name: string;
  snapshot: CampaignEntry;
};
export function CampaignComposer({
  initial,
  id,
  initialTemplate,
  onDirtyChange,
  onClose,
  onSaved,
  onQueued,
  onDelivery,
}: {
  initial?: CampaignEntry;
  id?: string;
  initialTemplate?: EmailTemplate;
  onDirtyChange?: (dirty: boolean) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onQueued: () => void;
  onDelivery?: () => void;
}) {
  const seed =
    initial ??
    (initialTemplate
      ? {
          ...emptyCampaign,
          name: `${initialTemplate.name} email`.slice(0, 100),
          subject: initialTemplate.subject,
          body: initialTemplate.body,
        }
      : emptyCampaign);
  const [form, setForm] = useState<CampaignEntry>(seed),
    [saved, setSaved] = useState<CampaignEntry>(initial ?? emptyCampaign),
    [step, setStep] = useState(0),
    [furthest, setFurthest] = useState(0);
  const [preview, setPreview] = useState<AudiencePreview>(),
    [review, setReview] = useState<Review>(),
    [dispatches, setDispatches] = useState<Dispatch[]>([]),
    [revisions, setRevisions] = useState<Revision[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]),
    [templateId, setTemplateId] = useState(""),
    [busy, setBusy] = useState(!!id),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const request = useRef(0);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved),
    guard = useEmailEditGuard(dirty, false),
    valid = canSaveCampaign(form),
    archived = form.status === "archived";
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    let active = true;
    void api<{ templates: EmailTemplate[] }>("/api/staff/communications")
      .then((d) => {
        if (active) setTemplates(d.templates);
      })
      .catch(() => {});
    if (id)
      void api<{
        entry: CampaignEntry;
        revisions: Revision[];
        dispatches: Dispatch[];
      }>(`/api/staff/campaigns?id=${id}`)
        .then((d) => {
          if (active) {
            setForm(d.entry);
            setSaved(d.entry);
            setRevisions(d.revisions);
            setDispatches(d.dispatches);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    return () => {
      active = false;
    };
  }, [id]);
  function go(next: number) {
    setStep(next);
    setFurthest((v) => Math.max(v, next));
    requestAnimationFrame(() => heading.current?.focus());
  }
  function edit(patch: Partial<CampaignEntry>) {
    setForm((current) => ({ ...current, ...patch }));
    setReview(undefined);
    setConfirmed(false);
    setError("");
    setNotice("");
    if (patch.audience) {
      setPreview(undefined);
      setFurthest(1);
    } else setFurthest(1);
    request.current++;
  }
  async function audience(next = false) {
    setBusy(true);
    setError("");
    const sequence = ++request.current;
    try {
      const value = await api<AudiencePreview>("/api/staff/campaigns", {
        action: "preview",
        audience: form.audience,
      });
      if (sequence === request.current) {
        setPreview(value);
        if (next) go(1);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveDraft() {
    if (!valid) return undefined;
    setError("");
    setNotice("");
    const row = await api<CampaignEntry>("/api/staff/campaigns", {
      action: "save",
      ...form,
    });
    setForm(row);
    setSaved(row);
    onDirtyChange?.(false);
    await onSaved();
    return row;
  }
  async function saveOnly() {
    setBusy(true);
    try {
      const row = await saveDraft();
      if (row) setNotice("Draft saved. No emails were sent.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function prepare() {
    setBusy(true);
    setError("");
    setConfirmed(false);
    try {
      const row = dirty || !form.id ? await saveDraft() : form;
      if (!row) return;
      const checked = await api<Review>("/api/staff/campaigns", {
        action: "review",
        id: row.id,
        version: row.version,
      });
      setReview(checked);
      go(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function dispatch() {
    if (
      !review ||
      !confirmed ||
      dirty ||
      review.campaign.version !== form.version
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api("/api/staff/campaigns", {
        action: "dispatch",
        id: form.id,
        version: form.version,
        reviewToken: review.reviewToken,
        confirm: true,
      });
      onDirtyChange?.(false);
      onQueued();
    } catch (e) {
      setError((e as Error).message);
      setReview(undefined);
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    if (!form.id) return;
    setBusy(true);
    setError("");
    try {
      const row = await api<CampaignEntry>("/api/staff/campaigns", {
        action: archived ? "restore" : "archive",
        id: form.id,
        version: form.version,
      });
      setForm(row);
      setSaved(row);
      setReview(undefined);
      onDirtyChange?.(false);
      await onSaved();
      setNotice(
        archived
          ? "Email restored to drafts."
          : "Email archived. Sending history is retained.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Email campaign editor">
      <button
        className={`${styles.back} text-button`}
        disabled={busy}
        onClick={() => guard.proceed(onClose)}
      >
        ← All email campaigns
      </button>
      <header className={styles.composerHeader}>
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {form.id ? form.name : "New email campaign"}
          </h2>
          <p>
            {dirty
              ? "Unsaved changes"
              : form.id
                ? "Draft saved"
                : "Your email starts as a draft"}
          </p>
        </div>
        <div className={styles.headerActions}>
          <StatusBadge tone={archived ? "neutral" : "pending"}>
            {archived ? "Archived" : "Draft"}
          </StatusBadge>
          <button
            className="button secondary"
            disabled={busy || archived || !valid || (!dirty && !!form.id)}
            onClick={() => void saveOnly()}
          >
            {busy ? "Working…" : "Save draft"}
          </button>
        </div>
      </header>
      <ol className={styles.steps} aria-label="Email creation steps">
        {["Recipients", "Message", "Review & send"].map((label, i) => (
          <li key={label}>
            <button
              className="text-button"
              aria-current={step === i ? "step" : undefined}
              disabled={busy || i > furthest || (i === 2 && !review)}
              onClick={() => go(i)}
            >
              <span aria-hidden="true">{i + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className={styles.notice}>
          {error}
          {step === 2 && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void prepare()}
            >
              Refresh review
            </button>
          )}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {archived ? (
        <div className={styles.formCard}>
          <h3>This email is archived</h3>
          <p>Restore the draft to edit its message or choose a new audience.</p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void archive()}
          >
            Restore draft
          </button>
        </div>
      ) : step === 0 ? (
        <div className={styles.stage}>
          <section
            className={styles.formCard}
            aria-labelledby="campaign-recipients-heading"
          >
            <h3 id="campaign-recipients-heading">
              Who should receive this email?
            </h3>
            <p>
              Choose a subscriber group. Consent and email preferences are
              checked before sending.
            </p>
            <fieldset disabled={busy}>
              <legend className={styles.srOnly}>Audience source</legend>
              <label className={styles.choice}>
                <input
                  type="radio"
                  name="campaign-source"
                  checked={form.audience.source !== "public"}
                  onChange={() =>
                    edit({ audience: { city: "", profession: "" } })
                  }
                />
                <span>
                  <strong>Website accounts</strong>
                  <small>
                    People with verified email addresses who opted in to
                    newsletters.
                  </small>
                </span>
              </label>
              <label className={styles.choice}>
                <input
                  type="radio"
                  name="campaign-source"
                  checked={form.audience.source === "public"}
                  onChange={() =>
                    edit({
                      audience: { city: "", profession: "", source: "public" },
                    })
                  }
                />
                <span>
                  <strong>Newsletter subscribers</strong>
                  <small>
                    People who confirmed their subscription through the public
                    website.
                  </small>
                </span>
              </label>
              {form.audience.source !== "public" && (
                <details className={styles.advanced}>
                  <summary>
                    Narrow this audience{" "}
                    <span className={styles.muted}>(optional)</span>
                  </summary>
                  <label>
                    City
                    <input
                      maxLength={120}
                      value={form.audience.city}
                      placeholder="All cities"
                      onChange={(e) =>
                        edit({
                          audience: { ...form.audience, city: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    Profession
                    <input
                      maxLength={120}
                      value={form.audience.profession}
                      placeholder="All professions"
                      onChange={(e) =>
                        edit({
                          audience: {
                            ...form.audience,
                            profession: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <p className={styles.helper}>
                    Filters match the full profile value, ignoring case. Website
                    accounts are separate from approved membership.
                  </p>
                </details>
              )}
            </fieldset>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void audience()}
            >
              Check recipient count
            </button>
            {preview && (
              <>
                <div className={styles.audienceCount} role="status">
                  <strong>{preview.eligible}</strong>
                  <div>
                    <span>eligible recipients</span>
                    <small>{preview.matched} match the selected group</small>
                  </div>
                </div>
                {!preview.eligible && (
                  <p className={styles.helper}>
                    No eligible recipients yet. You can still write and save
                    your email.
                  </p>
                )}
                <details className={styles.audienceDetails}>
                  <summary>View recipient checks and sample</summary>
                  <p>
                    Excluded: {preview.unsubscribed} without consent,{" "}
                    {preview.unverified} unverified,{" "}
                    {preview.preference_blocked} blocked by preferences or
                    suppression.
                  </p>
                  <ul>
                    {preview.sample.map((p) => (
                      <li key={p.email}>
                        {p.name ? p.name + " · " : ""}
                        {p.email}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            )}
            <footer className={styles.actions}>
              <button
                className="button gold"
                disabled={busy}
                onClick={() => void audience(true)}
              >
                Continue to message →
              </button>
            </footer>
          </section>
          <aside className={styles.sideCard}>
            <h3>Your email sender</h3>
            <dl className={styles.sender}>
              <div>
                <dt>From</dt>
                <dd>
                  TPA
                  <br />
                  updates@updates.tpassociation.org
                </dd>
              </div>
              <div>
                <dt>Replies go to</dt>
                <dd>contact@updates.tpassociation.org</dd>
              </div>
            </dl>
            <p>
              Recipients can manage newsletter preferences or unsubscribe from
              campaign emails.
            </p>
          </aside>
        </div>
      ) : step === 1 ? (
        <div className={styles.stage}>
          <form
            className={styles.formCard}
            onSubmit={(e) => {
              e.preventDefault();
              void prepare();
            }}
          >
            <h3>Write your email</h3>
            <p>A clear subject and a focused message work best.</p>
            <fieldset disabled={busy}>
              {!!templates.length && (
                <details className={styles.advanced}>
                  <summary>Start from a template</summary>
                  <label>
                    Saved template
                    <select
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                    >
                      <option value="">Choose a template</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={!templateId}
                    onClick={() => {
                      const chosen = templates.find((t) => t.id === templateId);
                      if (chosen)
                        edit({ subject: chosen.subject, body: chosen.body });
                    }}
                  >
                    Use template message
                  </button>
                  <p className={styles.helper}>
                    This replaces the subject and message in the editor.
                  </p>
                </details>
              )}
              <label>
                Email name
                <input
                  required
                  minLength={3}
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => edit({ name: e.target.value })}
                  placeholder="e.g. November community update"
                />
                <small>Only your team sees this name.</small>
              </label>
              <label>
                Subject line
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  value={form.subject}
                  onChange={(e) => edit({ subject: e.target.value })}
                  placeholder="What’s new at TPA?"
                />
                <small>{form.subject.length}/160 characters</small>
              </label>
              <label>
                Message
                <textarea
                  required
                  minLength={10}
                  maxLength={6000}
                  rows={12}
                  value={form.body}
                  onChange={(e) => edit({ body: e.target.value })}
                  placeholder="Hello,\n\nShare your update with the community…"
                />
                <small>
                  {form.body.length.toLocaleString("en-IN")}/6,000 characters ·
                  Plain text email
                </small>
              </label>
            </fieldset>
            <footer className={styles.actions}>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => go(0)}
              >
                ← Recipients
              </button>
              <button className="button gold" disabled={busy || !valid}>
                Save & review →
              </button>
            </footer>
            {!valid && (
              <p className={styles.helper}>
                Add an email name, subject, and a message of at least 10
                characters to save.
              </p>
            )}
          </form>
          <EmailMessagePreview
            subject={form.subject}
            body={form.body}
            to={audienceLabel(form.audience)}
          />
        </div>
      ) : review ? (
        <div className={styles.stage}>
          <section className={styles.formCard}>
            <h3>Ready for a final check</h3>
            <p>Review the saved message and recipients before confirming.</p>
            <dl className={styles.reviewList}>
              <div>
                <dt>Recipients</dt>
                <dd>
                  <strong>{review.eligible}</strong> eligible ·{" "}
                  {audienceLabel(form.audience)}{" "}
                  <button className="text-button" onClick={() => go(0)}>
                    Edit
                  </button>
                </dd>
              </div>
              <div>
                <dt>From</dt>
                <dd>TPA · updates@updates.tpassociation.org</dd>
              </div>
              <div>
                <dt>Reply-to</dt>
                <dd>contact@updates.tpassociation.org</dd>
              </div>
              <div>
                <dt>Subject</dt>
                <dd>
                  {review.campaign.subject}{" "}
                  <button className="text-button" onClick={() => go(1)}>
                    Edit message
                  </button>
                </dd>
              </div>
            </dl>
            <details className={styles.audienceDetails}>
              <summary>Recipient sample ({review.sample.length})</summary>
              <ul>
                {review.sample.map((p) => (
                  <li key={p.email}>
                    {p.name ? p.name + " · " : ""}
                    {p.email}
                  </li>
                ))}
              </ul>
              <p>
                The recipient list is fixed by this review. Consent and
                preferences are checked again before each delivery.
              </p>
            </details>
            {!review.readiness.enabled && (
              <p className={styles.notice}>
                Sending is paused. Your draft is saved and ready for later.
              </p>
            )}
            {!review.eligible && (
              <p className={styles.notice}>
                There are no eligible recipients. Choose a different group or
                keep this as a draft.
              </p>
            )}
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I have reviewed this message and its recipients.
            </label>
            <footer className={styles.actions}>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => go(1)}
              >
                ← Message
              </button>
              <button
                className="button gold"
                disabled={
                  busy ||
                  !confirmed ||
                  !review.eligible ||
                  !review.readiness.enabled ||
                  dirty
                }
                onClick={() => void dispatch()}
              >
                {busy ? "Queuing…" : "Confirm & queue email"}
              </button>
            </footer>
            <p className={styles.helper}>
              Queuing starts delivery processing. Provider acceptance and final
              delivery are tracked separately.
            </p>
            <details className={styles.advanced}>
              <summary>Sending limits and review expiry</summary>
              <p className={styles.helper}>
                This review expires after 10 minutes. Larger audiences can wait
                for quota resets; 20 daily sends are reserved for account
                recovery and replies.
              </p>
              {review.readiness.quota && (
                <p className={styles.helper}>
                  Daily usage: {review.readiness.quota.daily.used}/
                  {review.readiness.quota.daily.limit ?? "unlimited"}. Monthly:{" "}
                  {review.readiness.quota.monthly.used}/
                  {review.readiness.quota.monthly.limit ?? "unlimited"}.
                </p>
              )}
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void prepare()}
              >
                Refresh review
              </button>
            </details>
          </section>
          <EmailMessagePreview
            subject={review.campaign.subject}
            body={review.campaign.body}
            to={`${review.eligible} eligible recipients`}
          />
        </div>
      ) : (
        <div className={styles.formCard}>
          <h3>Refresh the review</h3>
          <p>
            The previous review is no longer available. Check the saved email
            again before sending.
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void prepare()}
          >
            Review saved email
          </button>
        </div>
      )}
      {!!form.id && (
        <details className={styles.history}>
          <summary>Sending history & draft history</summary>
          {dispatches.length ? (
            dispatches.map((d) => (
              <article key={d.id}>
                <strong>
                  {new Intl.DateTimeFormat("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(d.created_at))}
                </strong>
                <p>
                  {d.total} recipients · {d.queued} queued · {d.accepted}{" "}
                  provider-accepted{d.cancelled_at ? " · Cancelled" : ""}
                </p>
                {!d.cancelled_at && d.queued > 0 && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api("/api/staff/campaigns", {
                          action: "cancel",
                          dispatchId: d.id,
                          version: d.version,
                        });
                        const data = await api<{ dispatches: Dispatch[] }>(
                          `/api/staff/campaigns?id=${form.id}`,
                        );
                        setDispatches(data.dispatches);
                        setNotice(
                          "Pending recipients cancelled. Accepted messages remain in history.",
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Cancel pending recipients
                  </button>
                )}
              </article>
            ))
          ) : (
            <p>No sends yet.</p>
          )}
          {onDelivery && (
            <button className="button secondary" onClick={onDelivery}>
              View delivery activity
            </button>
          )}
          <details className={styles.advanced}>
            <summary>Saved revisions ({revisions.length})</summary>
            {revisions.map((r) => (
              <details key={r.version}>
                <summary>
                  Version {r.version} · {r.actor_name}
                </summary>
                <p>{r.snapshot.subject}</p>
                <p className={styles.messageBody}>{r.snapshot.body}</p>
              </details>
            ))}
          </details>
          {!dirty && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void archive()}
            >
              {archived ? "Restore draft" : "Archive email"}
            </button>
          )}
        </details>
      )}
      {guard.dialog}
    </section>
  );
}
