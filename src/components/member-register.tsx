"use client";
import { MemberApplicationDetails } from "./member-application-details";
import { MemberEditor, MemberCreator } from "./member-editor";
import { MemberAttendanceHistory } from "./member-attendance-history";
import { MemberVerificationReview } from "./member-verification-review";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { api } from "./operations-client";
import { InvitationReleaseReview } from "./invitation-release-review";
import { ProfileInspector } from "./profile-preview";
import { CopyValue, StatusBadge } from "./portal-values";
import styles from "./member-review.module.css";
import { WorkspaceEmptyState } from "./workspace-ui";
import { useEmailEditGuard } from "./email-edit-guard";
type Member = {
  person_id: string | null;
  record_kind?: "member" | "account";
  profile_review?: string;
  membership_version: number;
  person_version: number;
  invitation_status: string;
  address_completion_required?: boolean;
  delivery_status: string;
  pending_payments: number;
  user_id: string | null;
  person: {
    name: string;
    prefix?: string;
    firstName?: string;
    lastName?: string;
    organization?: string;
    jobTitle?: string;
    addresses?: unknown;
  };
  email: string;
  mobile: string;
  membership_number: string | null;
  type: string | null;
  status: string | null;
  professional_verified: boolean;
};
type Register = {
  rows: Member[];
  total: number;
  offset: number;
  pageSize: number;
};
const recordKey = (record: Member) =>
  record.record_kind === "account"
    ? "account:" + record.user_id
    : "member:" + record.person_id;

type LinkedAccount = {
  email: string;
  phone: string;
  staff_account: boolean;
  organization: string;
  profession: string;
  job_title: string;
  city: string;
  created_at: string;
};

function LinkedAccountDetails({ userId }: { userId: string }) {
  const [account, setAccount] = useState<LinkedAccount>();
  const [status, setStatus] = useState("Loading account details…");
  useEffect(() => {
    let active = true;
    api<{ rows: LinkedAccount[] }>(
      "/api/staff/members?id=" + encodeURIComponent(userId),
    )
      .then(({ rows }) => {
        if (!active) return;
        setAccount(rows[0]);
        setStatus(rows[0] ? "" : "Account details are unavailable.");
      })
      .catch(() => {
        if (active) setStatus("Could not load account details.");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <section className={styles.summary} aria-label="Linked account details">
      <h4>Linked account details</h4>
      {status && <p role="status">{status}</p>}
      {account && (
        <dl>
          <dt>Account type</dt>
          <dd>{account.staff_account ? "Staff account" : "Member account"}</dd>
          <dt>Login email</dt>
          <dd>
            <CopyValue value={account.email} />
          </dd>
          <dt>Account phone</dt>
          <dd>
            <CopyValue value={account.phone} />
          </dd>
          {[
            ["Organization", account.organization],
            ["Profession", account.profession],
            ["Job title", account.job_title],
            ["City", account.city],
            [
              "Account created",
              new Date(account.created_at).toLocaleDateString("en-IN"),
            ],
          ].map(([label, value]) => (
            <div className={styles.detailPair} key={label}>
              <dt>{label}</dt>
              <dd>{value || "Not supplied"}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
export function MemberRegister({
  canManage = false,
  canViewPayments = false,
}: {
  canManage?: boolean;
  canViewPayments?: boolean;
}) {
  const searchParams = useSearchParams();
  const [detailTab, setDetailTab] = useState("Member details");
  const [invitationMode, setInvitationMode] = useState(
    Boolean(searchParams.get("invitationReview")),
  );
  const personId = searchParams.get("personId");
  const actionParam = searchParams.get("action");
  const newParam = searchParams.get("new");
  const [memberDirty, setEditorDirty] = useState(false);
  const [applicationDirty, setApplicationDirty] = useState(false);
  const editorDirty = memberDirty || applicationDirty;
  const editorGuard = useEmailEditGuard(editorDirty);
  const createRequested =
    canManage && (actionParam === "create" || newParam === "true");
  const [previousCreateRequest, setPreviousCreateRequest] =
    useState(createRequested);
  const [isCreating, setIsCreating] = useState(createRequested);
  const createButton = useRef<HTMLButtonElement | null>(null);
  const createHeading = useRef<HTMLHeadingElement>(null);
  const closeDetails = () =>
    editorGuard.proceed(() => {
      setEditorDirty(false);
      setApplicationDirty(false);
      setSelected(undefined);
      setIsCreating(false);
    });
  const [data, setData] = useState<Register>(),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [busy, setBusy] = useState(false),
    [chosen, setChosen] = useState<string[]>([]),
    [invitation, setInvitation] = useState("all"),
    [kind, setKind] = useState("all"),
    [plan, setPlan] = useState("all"),
    [contact, setContact] = useState("all"),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState<Member>();
  useEffect(() => {
    if (isCreating) createHeading.current?.focus();
  }, [isCreating]);
  // Adjust local editor state when navigation changes the creation request.
  if (previousCreateRequest !== createRequested) {
    setPreviousCreateRequest(createRequested);
    if (createRequested) {
      setSelected(undefined);
      setIsCreating(true);
    }
  }
  async function load(
    offset = 0,
    filters = { q, status, invitation, kind, plan, contact },
    discard = false,
  ) {
    if (editorDirty && !discard) {
      editorGuard.proceed(() => {
        setEditorDirty(false);
        setApplicationDirty(false);
        setSelected(undefined);
        setIsCreating(false);
        void load(offset, filters, true);
      });
      return;
    }
    const request = ++requestSerial.current;
    try {
      const result = await api<Register>(
        "/api/staff/members?view=register&q=" +
          encodeURIComponent(filters.q) +
          "&status=" +
          filters.status +
          "&offset=" +
          offset +
          "&invitation=" +
          filters.invitation +
          "&records=all&" +
          new URLSearchParams({
            kind: filters.kind,
            plan: filters.plan,
            contact: filters.contact,
          }) +
          (personId ? "&id=" + encodeURIComponent(personId) : ""),
      );
      if (request !== requestSerial.current) return;
      setData(result);
      setSelected((current) =>
        current
          ? result.rows.find((row) => recordKey(row) === recordKey(current))
          : undefined,
      );
      setMessage("");
    } catch (e) {
      if (request === requestSerial.current) setMessage((e as Error).message);
    }
  }
  const requestSerial = useRef(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (selected) detailHeading.current?.focus();
  }, [selected]);
  useEffect(() => {
    let active = true;
    const request = ++requestSerial.current;
    const held =
      new URLSearchParams(location.search).get("invitation") === "held";
    void api<Register>(
      "/api/staff/members?view=register&records=all&invitation=" +
        (held ? "held" : "all") +
        (personId ? "&id=" + encodeURIComponent(personId) : ""),
    )
      .then((result) => {
        if (!active || request !== requestSerial.current) return;
        setInvitation(held ? "held" : "all");
        setData(result);
        if (personId) {
          setDetailTab("Member details");
          setSelected(result.rows[0]);
        }
      })
      .catch((e) => {
        if (active && request === requestSerial.current) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [personId]);
  return (
    <section className="member-register-workspace" data-portal-primary>
      <h2 className="sr-only">Association directory</h2>
      {personId && (
        <Link href="/admin/workspaces/members">View all members →</Link>
      )}
      <form
        className="action-row member-register-filters"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label>
          Search members
          <input
            maxLength={120}
            placeholder="Name, membership number, email or mobile"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          Membership type
          <select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="all">All plans</option>
            <option value="Life">Life member</option>
            <option value="Patron">Patron member</option>
            <option value="Annual">Annual (legacy)</option>
          </select>
        </label>
        <label>
          Invitations
          <select
            value={invitation}
            onChange={(e) => setInvitation(e.target.value)}
          >
            <option value="all">All accounts</option>
            <option value="held">Invitations held</option>
          </select>
        </label>
        <label>
          Record type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">Members & accounts</option>
            <option value="member">Membership records</option>
            <option value="account">Accounts without membership</option>
          </select>
        </label>
        <button className="button" disabled={busy}>
          Search register
        </button>
        <details className="directory-extra-filters">
          <summary>More filters</summary>
          <div className="form-grid">
            <label>
              Membership status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {[
                  "all",
                  "active",
                  "expired",
                  "suspended",
                  "resigned",
                  "unknown",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Phone availability
              <select
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              >
                <option value="all">Any</option>
                <option value="phone">Phone supplied</option>
                <option value="no-phone">No phone</option>
              </select>
            </label>
          </div>
        </details>
      </form>
      <div className="member-register-resultbar">
        <p>{data ? `${data.total} directory records` : "Loading directory…"}</p>
        {canManage && (
          <div className="action-row" style={{ margin: 0 }}>
            <button
              type="button"
              className="button"
              ref={createButton}
              onClick={() => {
                editorGuard.proceed(() => {
                  setSelected(undefined);
                  setEditorDirty(false);
                  setApplicationDirty(false);
                  setIsCreating(true);
                });
              }}
            >
              + Create member
            </button>
            <button
              type="button"
              className="button secondary"
              aria-pressed={invitationMode}
              onClick={() => {
                setInvitationMode(!invitationMode);
                setChosen([]);
              }}
            >
              {invitationMode ? "Done selecting" : "Send invitations"}
            </button>
          </div>
        )}
      </div>
      {invitationMode && (
        <div className="member-register-bulk">
          <p>
            Select members to review and send account invitations. This does not
            approve membership.
          </p>
          <InvitationReleaseReview
            personIds={chosen}
            canManage={canManage}
            onComplete={() => {
              void load();
              setChosen([]);
            }}
          />
          <button
            className="button secondary"
            disabled={!canManage || busy}
            onClick={() =>
              setChosen((old) => [
                ...new Set([
                  ...old,
                  ...(data?.rows ?? [])
                    .filter(
                      (m) =>
                        m.person_id &&
                        m.record_kind !== "account" &&
                        m.user_id &&
                        !["accepted", "active account"].includes(
                          m.invitation_status,
                        ),
                    )
                    .map((m) => m.person_id!),
                ]),
              ])
            }
          >
            Select all who can be invited
          </button>
        </div>
      )}
      <div className="profile-results-layout">
        <div>
          <div
            className="table-wrap member-register-table"
            role="region"
            aria-label="Member register records"
            tabIndex={0}
          >
            <table className="operations-table">
              <thead>
                <tr>
                  {invitationMode && (
                    <th
                      scope="col"
                      className="member-register-selection-column"
                    >
                      <span className="sr-only">Select member</span>
                    </th>
                  )}
                  <th scope="col" className="member-register-person-column">
                    Person
                  </th>
                  <th scope="col">Membership no.</th>
                  <th scope="col">Membership type</th>
                  <th scope="col">Account status</th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((m) => (
                  <tr
                    key={recordKey(m)}
                    data-member-record
                    onClick={(event) => {
                      if (!(event.target instanceof Element) ||
                          event.target.closest("button, a, input, select, textarea, label")) return;
                      if (window.getSelection()?.toString()) return;
                      event.currentTarget.querySelector<HTMLButtonElement>(".member-record-button")?.click();
                    }}
                    className={
                      selected && recordKey(selected) === recordKey(m)
                        ? "is-selected"
                        : ""
                    }
                  >
                    {invitationMode && (
                      <td className="member-register-selection-column">
                        <label className="member-register-select">
                          <input
                            type="checkbox"
                            disabled={
                              !canManage ||
                              busy ||
                              !m.person_id ||
                              m.record_kind === "account" ||
                              !m.user_id ||
                              ["accepted", "active account"].includes(
                                m.invitation_status,
                              )
                            }
                            checked={Boolean(
                              m.person_id && chosen.includes(m.person_id),
                            )}
                            onChange={(e) => {
                              const personId = m.person_id;
                              if (!personId || m.record_kind === "account")
                                return;
                              setChosen((old) =>
                                e.target.checked
                                  ? [...old, personId]
                                  : old.filter((id) => id !== personId),
                              );
                            }}
                          />
                          <span className="sr-only">
                            Select {m.person.name}
                          </span>
                        </label>
                      </td>
                    )}
                    <td>
                      <button
                        type="button"
                        className="link-button member-record-button"
                        aria-label={"Open " + m.person.name + " details"}
                        disabled={Boolean(selected || isCreating)}
                        onClick={(event) => {
                          const trigger = event.currentTarget;
                          editorGuard.proceed(() => {
                            selectedButton.current = trigger;
                            setEditorDirty(false);
                            setApplicationDirty(false);
                            setIsCreating(false);
                            setDetailTab("Member details");
                            setSelected(m);
                          });
                        }}
                      >
                        <span className="member-record-avatar" aria-hidden="true">
                          {m.person.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("")}
                        </span>
                        <strong>{m.person.name}</strong>
                      </button>
                      <div className="member-record-contact">
                        <CopyValue value={m.email} />
                      </div>
                    </td>
                    <td>
                      <CopyValue
                        value={m.membership_number}
                        label="membership number"
                      />
                    </td>
                    <td>{m.type || "No plan"}</td>
                    <td>
                      <StatusBadge tone={m.status === "active" ? "success" : "neutral"}>
                        {m.status === "active" ? "Active" : "Not active"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
                {data && !data.rows.length && (
                  <tr>
                    <td
                      colSpan={invitationMode ? 5 : 4}
                      className="member-register-empty"
                    >
                      <WorkspaceEmptyState
                        icon="people"
                        title="No records match these filters"
                        description="Try another search or reset the filters to browse the association directory."
                        actionLabel="Reset member filters"
                        onAction={() => {
                          setQ("");
                          setStatus("all");
                          setInvitation("all");
                          setKind("all");
                          setPlan("all");
                          setContact("all");
                          void load(0, {
                            q: "",
                            status: "all",
                            invitation: "all",
                            kind: "all",
                            plan: "all",
                            contact: "all",
                          });
                        }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {data && (
            <div className="action-row">
              <button
                disabled={!data.offset}
                onClick={() =>
                  void load(Math.max(0, data.offset - data.pageSize))
                }
              >
                Previous members
              </button>
              <button
                disabled={data.offset + data.pageSize >= data.total}
                onClick={() => void load(data.offset + data.pageSize)}
              >
                Next members
              </button>
            </div>
          )}
        </div>
        {isCreating && (
          <ProfileInspector
            modal
            returnFocus={createButton}
            label="Create new member"
            closeDisabled={busy}
            onClose={() => {
              if (!busy) closeDetails();
            }}
          >
            {editorGuard.dialog}
            <section
              id="member-register-detail"
              className="member-register-detail"
              aria-label="Create new member"
            >
              <div className="member-detail-heading">
                <h3 ref={createHeading} tabIndex={-1}>
                  Create new member
                </h3>
              </div>
              <p>Add a member directly to the association directory.</p>
              <MemberCreator
                onDirtyChange={setEditorDirty}
                onCancel={closeDetails}
                onSaved={async (newPersonId) => {
                  setEditorDirty(false);
                  setApplicationDirty(false);
                  setIsCreating(false);
                  await load(
                    0,
                    {
                      q: "",
                      status: "all",
                      invitation: "all",
                      kind: "all",
                      plan: "all",
                      contact: "all",
                    },
                    true,
                  );
                  try {
                    const result = await api<Register>(
                      `/api/staff/members?view=register&records=all&id=${encodeURIComponent(newPersonId)}`,
                    );
                    if (result.rows.length) {
                      setSelected(result.rows[0]);
                    }
                  } catch {}
                  setMessage("Member created successfully.");
                }}
              />
            </section>
          </ProfileInspector>
        )}
        {selected && !isCreating && (
          <ProfileInspector
            modal
            returnFocus={selectedButton}
            label={`${selected.person.name} member details`}
            closeDisabled={busy}
            onClose={() => {
              if (!busy) closeDetails();
            }}
          >
            {editorGuard.dialog}
            <section
              id="member-register-detail"
              className="member-register-detail"
              aria-label="Member details"
            >
              <div className="member-detail-heading">
                <h3 ref={detailHeading} tabIndex={-1}>
                  {selected.person.name}
                </h3>
              </div>
              <div className={styles.identity}>
                <StatusBadge
                  tone={selected.status === "active" ? "active" : "neutral"}
                >
                  {selected.status === "active" ? "Active" : "Not active"}
                </StatusBadge>
                <span>
                  {selected.type || "No membership plan"} ·{" "}
                  {selected.membership_number || "No membership number"}
                </span>
              </div>
              <nav className={styles.tabs} aria-label="Member details sections">
                {[
                  "Member details",
                  ...(canManage ? ["Application review"] : []),
                  "Attendance",
                  ...(canManage ? ["Manage membership"] : []),
                ].map((tab) => (
                  <button
                    type="button"
                    key={tab}
                    disabled={busy}
                    aria-pressed={detailTab === tab}
                    onClick={() =>
                      editorGuard.proceed(() => {
                        setEditorDirty(false);
                        setApplicationDirty(false);
                        setDetailTab(tab);
                      })
                    }
                  >
                    {tab}
                  </button>
                ))}
              </nav>
              {detailTab === "Member details" && canManage && (
                <div className={styles.detailActions}>
                  {(selected.user_id ||
                    (selected.person_id &&
                      selected.record_kind !== "account")) && (
                    <button
                      type="button"
                      className="button"
                      onClick={() => setDetailTab("Edit details")}
                    >
                      Edit details
                    </button>
                  )}
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setDetailTab("Application review")}
                  >
                    Review application
                  </button>
                </div>
              )}
              {detailTab === "Member details" && (
                <div className={styles.summary}>
                  <h4>Contact & membership</h4>
                  <dl>
                    <dt>Membership number</dt>
                    <dd>
                      <CopyValue
                        value={selected.membership_number}
                        label="membership number"
                      />
                    </dd>
                    <dt>Email</dt>
                    <dd>
                      <CopyValue value={selected.email} />
                    </dd>
                    <dt>Mobile</dt>
                    <dd>
                      <CopyValue value={selected.mobile} />
                    </dd>
                    <dt>Organization</dt>
                    <dd>{selected.person.organization || "Not supplied"}</dd>
                    <dt>Designation</dt>
                    <dd>{selected.person.jobTitle || "Not supplied"}</dd>
                    <dt>Invitation</dt>
                    <dd>
                      {selected.invitation_status} · delivery:{" "}
                      {selected.delivery_status || "not sent"}
                    </dd>
                    <dt>Address completion</dt>
                    <dd>
                      {selected.address_completion_required
                        ? "Required after activation"
                        : "See recorded addresses"}
                    </dd>
                    <dt>Account</dt>
                    <dd>
                      {selected.user_id ? "Linked account" : "No login account"}
                    </dd>
                    <dt>Pending event payments</dt>
                    <dd>
                      {selected.pending_payments}{" "}
                      {canViewPayments && (
                        <Link href="/admin/workspaces/payments">
                          Inspect payments
                        </Link>
                      )}
                    </dd>
                    <dt>Account status</dt>
                    <dd>
                      {selected.status === "active" ? "Active" : "Not active"}
                    </dd>
                  </dl>
                  {selected.user_id && (
                    <LinkedAccountDetails
                      key={selected.user_id}
                      userId={selected.user_id}
                    />
                  )}
                </div>
              )}
              {detailTab === "Attendance" && (
                <section className={styles.section}>
                  {selected.person_id ? (
                    <MemberAttendanceHistory
                      key={selected.person_id}
                      personId={selected.person_id}
                    />
                  ) : (
                    <p>No membership record is linked to this account.</p>
                  )}
                </section>
              )}
              {detailTab === "Application review" && (
                <section className={styles.section}>
                  <h4>Application review</h4>
                  <p>
                    Check the submitted details and evidence, then approve or
                    request changes. Approval activates the membership.
                  </p>
                  {canManage && (
                    <MemberVerificationReview
                      onBusyChange={setBusy}
                      autoOpen
                      key={recordKey(selected)}
                      personId={selected.person_id}
                      userId={selected.user_id}
                      name={selected.person.name}
                      verified={selected.professional_verified}
                      disabled={busy || editorDirty}
                      onApproved={async () => {
                        await load(0);
                      }}
                    />
                  )}
                </section>
              )}
              {detailTab === "Manage membership" && (
                <section className={styles.section}>
                  <h4>Manage membership</h4>
                  <p>
                    Account approval activates the membership. Choose a plan if the member did not select one.
                  </p>
                  <div className={styles.membershipControls}>
                    <button
                      className="button secondary"
                      disabled={
                        !canManage ||
                        busy ||
                        editorDirty ||
                        !selected.person_id ||
                        selected.record_kind === "account" ||
                        !selected.user_id ||
                        ["accepted", "active account"].includes(
                          selected.invitation_status,
                        )
                      }
                      onClick={() => {
                        if (
                          selected.person_id &&
                          selected.record_kind !== "account"
                        ) {
                          setInvitationMode(true);
                          setChosen([selected.person_id]);
                          setSelected(undefined);
                        }
                      }}
                    >
                      Review this member invitation
                    </button>
                    <label>
                      Membership type
                      <select
                        value={selected.type ?? ""}
                        disabled={busy || editorDirty || !selected.user_id || selected.type === "Life" || selected.type === "Patron"}
                        onChange={async (event) => {
                          const plan = event.target.value;
                          if (!selected.user_id || !["Life", "Patron"].includes(plan)) return;
                          setBusy(true);
                          try {
                            await api("/api/staff/member-actions", {
                              action: "membership-plan",
                              userId: selected.user_id,
                              plan,
                            });
                            await load(data?.offset ?? 0);
                            setMessage("Membership type saved.");
                          } catch (error) {
                            setMessage((error as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <option value="" disabled>Choose Life or Patron</option>
                        {selected.type === "Annual" && <option value="Annual" disabled>Annual (legacy)</option>}
                        <option value="Life">Life member</option>
                        <option value="Patron">Patron member</option>
                      </select>
                    </label>
                  </div>
                  <details>
                    <summary>Recorded addresses</summary>
                    {Object.entries(
                      (selected.person.addresses as Record<
                        string,
                        Record<string, string>
                      >) ?? {},
                    ).map(([kind, a]) => (
                      <p key={kind}>
                        <strong>{kind}</strong>
                        <br />
                        {[
                          a.line1,
                          a.line2,
                          a.city,
                          a.district,
                          a.state,
                          a.postalCode,
                          a.country,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    ))}
                  </details>
                  {canManage &&
                    selected.person_id &&
                    selected.record_kind !== "account" && (
                      <button
                        type="button"
                        className={`button danger ${styles.deleteMember}`}
                        disabled={busy || editorDirty}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Delete ${selected.person.name} from the member directory? Their profile will be archived and removed from public view. Their login account, payment records and history will be retained. You can restore the profile from Publishing → Committees & people → Archived.`,
                            )
                          )
                            return;
                          setBusy(true);
                          try {
                            await api("/api/staff/member-actions", {
                              action: "delete",
                              personId: selected.person_id,
                              personVersion: selected.person_version,
                              version: selected.membership_version,
                            });
                            setChosen((previous) =>
                              previous.filter(
                                (id) => id !== selected.person_id,
                              ),
                            );
                            setSelected(undefined);
                            await load(0);
                            setMessage(
                              "Member deleted from the directory. Their archived profile can be restored from Publishing → Committees & people.",
                            );
                            createButton.current?.focus();
                          } catch (error) {
                            setMessage(
                              error instanceof Error
                                ? error.message
                                : "Unable to delete member. Try again.",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Delete member
                      </button>
                    )}
                </section>
              )}
              {detailTab === "Edit details" && (
                <section className={styles.section}>
                  <h4>Edit member details</h4>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      editorGuard.proceed(() => {
                        setEditorDirty(false);
                        setApplicationDirty(false);
                        setDetailTab("Member details");
                      })
                    }
                  >
                    Back to member details
                  </button>
                  {canManage &&
                    selected.person_id &&
                    selected.record_kind !== "account" && (
                      <MemberEditor
                        key={selected.person_id + selected.person_version}
                        member={{ ...selected, person_id: selected.person_id }}
                        onDirtyChange={setEditorDirty}
                        onSaved={() => {
                          setEditorDirty(false);
                          void load(
                            data?.offset ?? 0,
                            {
                              q,
                              status,
                              invitation,
                              kind,
                              plan,
                              contact,
                            },
                            true,
                          );
                        }}
                      />
                    )}
                </section>
              )}
              {canManage &&
                selected.user_id &&
                (detailTab === "Member details" ||
                  detailTab === "Edit details") && (
                  <MemberApplicationDetails
                    key={selected.user_id + detailTab}
                    userId={selected.user_id}
                    editing={detailTab === "Edit details"}
                    onDirtyChange={setApplicationDirty}
                  />
                )}
              {message && <p role="status">{message}</p>}
            </section>
          </ProfileInspector>
        )}
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
