"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "./operations-client";
type Person = {
  id: string;
  person_id: string | null;
  profile_review: string;
  name: string;
  email: string;
  email_verified: boolean;
  phone: string;
  organization: string;
  profession: string;
  job_title: string;
  city: string;
  staff_account: boolean;
  created_at: string;
};
type Filters = {
  q: string;
  verification: string;
  contact: string;
  review: string;
};
type Directory = {
  rows: Person[];
  total: number;
  offset: number;
  pageSize: number;
};
const empty: Filters = {
  q: "",
  verification: "all",
  contact: "all",
  review: "all",
};
export function MembersWorkspace() {
  const [filters, setFilters] = useState(empty),
    [applied, setApplied] = useState(empty);
  const [directory, setDirectory] = useState<Directory>(),
    [selected, setSelected] = useState<Person>();
  const [searches, setSearches] = useState<Filters[]>([]),
    [viewed, setViewed] = useState<Person[]>([]);
  const [busy, setBusy] = useState(true),
    [message, setMessage] = useState("Loading accounts…");
  const serial = useRef(0);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selected) previewHeading.current?.focus();
  }, [selected]);
  async function load(next: Filters, offset = 0, remember = false) {
    const attempt = ++serial.current;
    setBusy(true);
    setMessage("Loading accounts…");
    setDirectory(undefined);
    setSelected(undefined);
    try {
      const data = await api<Directory>(
        `/api/staff/members?${new URLSearchParams({ ...next, offset: String(offset) })}`,
      );
      if (attempt !== serial.current) return;
      setDirectory(data);
      setApplied(next);
      setFilters(next);
      setMessage("");
      if (
        remember &&
        (next.q ||
          next.verification !== "all" ||
          next.contact !== "all" ||
          next.review !== "all")
      )
        setSearches((old) =>
          [
            next,
            ...old.filter(
              (item) => JSON.stringify(item) !== JSON.stringify(next),
            ),
          ].slice(0, 5),
        );
    } catch (error) {
      if (attempt === serial.current) setMessage((error as Error).message);
    } finally {
      if (attempt === serial.current) setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    api<Directory>("/api/staff/members" + (location.search || ""))
      .then((data) => {
        if (active) {
          setDirectory(data);
          if (new URLSearchParams(location.search).has("id"))
            setSelected(data.rows[0]);
          setMessage("");
        }
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function preview(person: Person) {
    setBusy(true);
    setMessage("");
    setSelected(undefined);
    try {
      const result = await api<Directory>(
        `/api/staff/members?id=${encodeURIComponent(person.id)}`,
      );
      const current = result.rows[0];
      setSelected(current);
      setViewed((old) =>
        [current, ...old.filter((item) => item.id !== current.id)].slice(0, 5),
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(
        `Copy unavailable. Select the ${label.toLowerCase()} below and copy it manually.`,
      );
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(filters, 0, true);
  }
  return (
    <>
      <p className="notice">
        Account directory for authorized membership staff. An account or
        verified email is not an approved membership. Paid application review
        remains pending approved terms and payment verification; private
        application drafts are excluded.
      </p>
      <form className="crm-filters" onSubmit={submit}>
        <label className="crm-search">
          Search accounts
          <input
            ref={searchInput}
            disabled={busy}
            maxLength={120}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="Name, email, phone, company, profession or city"
          />
        </label>
        <label>
          Email verification
          <select
            disabled={busy}
            value={filters.verification}
            onChange={(e) =>
              setFilters({ ...filters, verification: e.target.value })
            }
          >
            <option value="all">All accounts</option>
            <option value="verified">Verified email</option>
            <option value="unverified">Unverified email</option>
          </select>
        </label>
        <label>
          Phone availability
          <select
            disabled={busy}
            value={filters.contact}
            onChange={(e) =>
              setFilters({ ...filters, contact: e.target.value })
            }
          >
            <option value="all">Any</option>
            <option value="phone">Phone supplied</option>
            <option value="no-phone">No phone</option>
          </select>
        </label>
        <label>
          Profile review
          <select
            disabled={busy}
            value={filters.review}
            onChange={(e) => setFilters({ ...filters, review: e.target.value })}
          >
            {["all", "unverified", "pending", "verified", "rejected"].map(
              (v) => (
                <option key={v} value={v}>
                  {v === "all" ? "Any review status" : v}
                </option>
              ),
            )}
          </select>
        </label>
        <button className="button" disabled={busy}>
          Search
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={busy}
          onClick={() => void load(empty)}
        >
          Reset
        </button>
      </form>
      {(searches.length > 0 || viewed.length > 0) && (
        <section
          className="directory-recents"
          aria-label="Recent directory activity"
        >
          <div className="action-row">
            <h2>Recent activity</h2>
            <button
              className="button secondary"
              onClick={() => {
                setSearches([]);
                setViewed([]);
              }}
            >
              Clear recent activity
            </button>
          </div>
          <p>Only retained while this workspace is open.</p>
          {searches.length > 0 && (
            <>
              <h3>Recent searches</h3>
              <div className="action-row">
                {searches.map((item, index) => (
                  <button
                    className="button secondary"
                    disabled={busy}
                    key={index}
                    onClick={() => void load(item, 0, true)}
                  >
                    {item.q || "All names"} · {item.verification} ·{" "}
                    {item.contact}
                  </button>
                ))}
              </div>
            </>
          )}
          {viewed.length > 0 && (
            <>
              <h3>Recently viewed</h3>
              <div className="action-row">
                {viewed.map((item) => (
                  <button
                    className="button secondary"
                    disabled={busy}
                    key={item.id}
                    onClick={() => void preview(item)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}
      {directory && (
        <div className="crm-result-bar">
          <span>
            {directory.total} accounts ·{" "}
            {directory.total ? directory.offset + 1 : 0}–
            {Math.min(
              directory.offset + directory.rows.length,
              directory.total,
            )}
          </span>
          <div>
            <button
              disabled={busy || !directory.offset}
              onClick={() =>
                void load(applied, Math.max(0, directory.offset - 25))
              }
            >
              Previous
            </button>
            <button
              disabled={busy || directory.offset + 25 >= directory.total}
              onClick={() => void load(applied, directory.offset + 25)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      <div className="directory-layout">
        <section aria-label="Account results" className="record-list">
          {directory?.rows.map((person) => (
            <button
              disabled={busy}
              aria-pressed={person.id === selected?.id}
              key={person.id}
              onClick={() => void preview(person)}
            >
              <strong>{person.name}</strong>
              <span>{person.email}</span>
              <small>
                {person.organization || "Organization not supplied"} ·{" "}
                {person.email_verified ? "Verified email" : "Unverified email"}{" "}
                · Profile: {person.profile_review}
                {person.staff_account ? " · Staff account" : ""}
              </small>
            </button>
          ))}
          {directory && !directory.rows.length && (
            <p>No accounts match these filters.</p>
          )}
        </section>
        <aside className="directory-preview" aria-label="Quick profile preview">
          {selected ? (
            <>
              <div className="action-row">
                <h2 ref={previewHeading} tabIndex={-1}>
                  {selected.name}
                </h2>
                <button
                  className="button secondary"
                  onClick={() => {
                    setSelected(undefined);
                    searchInput.current?.focus();
                  }}
                >
                  Close preview
                </button>
              </div>
              <p>
                {selected.staff_account ? "Staff account" : "Account"} ·{" "}
                {selected.email_verified
                  ? "Verified email"
                  : "Unverified email"}
              </p>
              {selected?.person_id && (
                <p>
                  <a
                    className="text-link"
                    href={`/admin/workspaces/governance?id=${selected.person_id}`}
                  >
                    Edit / review personal details →
                  </a>
                </p>
              )}
              <dl className="contact-details">
                <div>
                  <dt>Email</dt>
                  <dd>{selected.email}</dd>
                  <button
                    className="button secondary"
                    onClick={() => void copy(selected.email, "Email")}
                  >
                    Copy email
                  </button>
                </div>
                <div>
                  <dt>Mobile / phone</dt>
                  <dd>{selected.phone || "Not supplied"}</dd>
                  <button
                    className="button secondary"
                    disabled={!selected.phone}
                    onClick={() => void copy(selected.phone, "Phone")}
                  >
                    Copy phone
                  </button>
                </div>
                {[
                  ["Organization", selected.organization],
                  ["Profession", selected.profession],
                  ["Job title", selected.job_title],
                  ["City", selected.city],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || "Not supplied"}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Account created{" "}
                {new Date(selected.created_at).toLocaleDateString("en-IN")}.
                Membership approval is not established by this record.
              </p>
            </>
          ) : (
            <>
              <h2>Quick profile preview</h2>
              <p>Select an account to view contact and professional details.</p>
            </>
          )}
        </aside>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </>
  );
}
