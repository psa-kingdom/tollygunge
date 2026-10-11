"use client";
import { useState } from "react";
import {
  PublicGovernance,
  type PublicGovernanceEntry,
} from "./public-governance";
export function MemberProfilePreview({
  draft,
  published,
  dirty,
}: {
  draft: PublicGovernanceEntry[];
  published: PublicGovernanceEntry[];
  dirty: boolean;
}) {
  const [view, setView] = useState("draft");
  return (
    <section className="member-profile-preview" aria-label="Profile preview">
      <div className="form-section-heading">
        <span className="eyebrow">YOUR PUBLIC IDENTITY</span>
        <h2>Profile preview</h2>
        <p>
          {view === "draft"
            ? `${dirty ? "Unsaved changes" : "Saved draft"} · private and unpublished`
            : "Currently published · visible on the public website"}
        </p>
      </div>
      <div className="preview-switch" aria-label="Preview version">
        <button
          type="button"
          aria-pressed={view === "draft"}
          onClick={() => setView("draft")}
        >
          Private draft
        </button>
        <button
          type="button"
          aria-pressed={view === "published"}
          onClick={() => setView("published")}
        >
          Published profile
        </button>
      </div>
      {view === "published" && !published.length ? (
        <div className="profile-empty">
          <h3>No public profile yet</h3>
          <p>
            Review and explicit publication are required before your details
            appear publicly.
          </p>
        </div>
      ) : (
        <PublicGovernance entries={view === "draft" ? draft : published} />
      )}
      <p className="field-help">
        Only public profile fields and selected public links appear here. Your
        phone, email, addresses and documents remain private.
      </p>
    </section>
  );
}
