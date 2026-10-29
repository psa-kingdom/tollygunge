"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ProfilePreview, ProfileInspector } from "./profile-preview";
import { CopyValue, StatusBadge } from "./portal-values";
import { api } from "./operations-client";
import { MemberRegister } from "./member-register";
import { useSearchParams } from "next/navigation";
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
  membership_number?: string;
  source_details?: Record<string, string>;
  category?: string;
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
export function MembersWorkspace({
  canManage = false,
}: {
  canManage?: boolean;
}) {
  const searchParams = useSearchParams();
  const recordId = searchParams.get("id");
  const requestedView = searchParams.get("view");
  const view = recordId || requestedView === "accounts" ? "accounts" : "register";
  return (
    <>
      {view === "register" ? (
        <MemberRegister canManage={canManage} />
      ) : (
        <AccountDirectory key={recordId ?? "accounts"} />
      )}
    </>
  );
}
function AccountDirectory() {
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
  const selectedTrigger = useRef<HTMLButtonElement>(null);
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
    const attempt = ++serial.current;
    setBusy(true);
    setMessage("");
    setSelected(undefined);
    try {
      const result = await api<Directory>(
        `/api/staff/members?id=${encodeURIComponent(person.id)}`,
      );
      if (attempt !== serial.current) return;
      const current = result.rows[0];
      if (!current) throw Error("This account is no longer available.");
      setSelected(current);
      setViewed((old) =>
        [current, ...old.filter((item) => item.id !== current.id)].slice(0, 5),
      );
    } catch (error) {
      if (attempt === serial.current) setMessage((error as Error).message);
    } finally {
      if (attempt === serial.current) setBusy(false);
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
            <div className="directory-record" key={person.id}>
              <ProfilePreview key={JSON.stringify(filters)} profile={{name: person.name, email: person.email, phone: person.phone, number: person.membership_number, organization: person.organization, emailVerified: person.email_verified, profileVerified: person.profile_review === "verified"}} disabled={Boolean(selected)} selected={selected?.id === person.id} onPin={trigger => {selectedTrigger.current = trigger; void preview(person);}} />
              <div className="member-record-contact"><CopyValue value={person.email} /></div>
              <small>{person.organization || "Organization not supplied"} · <StatusBadge tone={person.email_verified ? "success" : "pending"}>{person.email_verified ? "Email verified" : "Email unverified"}</StatusBadge> · Profile: {person.profile_review}{person.staff_account ? " · Staff account" : ""}</small>
            </div>
          ))}
          {directory && !directory.rows.length && (
            <p>No accounts match these filters.</p>
          )}
        </section>
        {selected && <ProfileInspector returnFocus={selectedTrigger} label={`${selected.name} account details`} onClose={() => setSelected(undefined)}><aside className="directory-preview" aria-label="Quick profile preview">
          {selected ? (
            <>
              <div className="action-row">
                <h2 ref={previewHeading} tabIndex={-1}>
                  {selected.name}
                </h2>

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
                  <dd><CopyValue value={selected.email} /></dd>
                </div>
                <div>
                  <dt>Mobile / phone</dt>
                  <dd><CopyValue value={selected.phone} /></dd>
                </div>
                {[
                  ["Organization", selected.organization],
                  ["Profession", selected.profession],
                  ["Job title", selected.job_title],
                  ["City", selected.city],
                  ["Membership number", selected.membership_number],
                  ["Category", selected.category],
                  ["Address", selected.source_details?.address],
                  ["Country", selected.source_details?.country],
                  ["State", selected.source_details?.state],
                  ["PIN", selected.source_details?.pin],
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
        </aside></ProfileInspector>}
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </>
  );
}
