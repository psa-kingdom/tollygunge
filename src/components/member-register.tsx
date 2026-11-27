"use client";
import { useMembershipPlans } from "./use-membership-plans";
import { MemberApplicationDetails } from "./member-application-details";
import { MemberEditor, MemberCreator } from "./member-editor";
import { MemberAttendanceHistory } from "./member-attendance-history";
import { MemberProfileTags, type ProfileTag } from "./member-profile-tags";
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
  profile_tags?: ProfileTag[];
  archived_at?: string | null;
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
  account_created_at: string | null;
  login_ready: boolean;
  protected_account?: boolean;
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
  pending_plan?: string | null;
  type: string | null;
  status: string | null;
  professional_verified: boolean;
};
type Register = {
  tags?: ProfileTag[];
  rows: Member[];
  total: number;
  offset: number;
  pageSize: number;
};
const recordKey = (record: Member) =>
  record.record_kind === "account"
    ? "account:" + record.user_id
    : "member:" + record.person_id;

function membershipStatus(member: Member) {
  return member.login_ready ? "Active" : "Inactive";
}

export function MemberRegister({
  canManage = false,
  canViewPayments = false,
}: {
  canManage?: boolean;
  canViewPayments?: boolean;
}) {
  const plans = useMembershipPlans();
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
    [accountSetup, setAccountSetup] = useState("all"),
    [archive, setArchive] = useState("current"),
    [plan, setPlan] = useState("all"),
    [contact, setContact] = useState("all"),
    [tag, setTag] = useState(""),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState<Member>();
  const canManageDetails = canManage && !selected?.archived_at;
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
    filters = { q, status, invitation, accountSetup, plan, contact, archive, tag },
    discard = false,
    keepSelected = false,
  ) {
    if (editorDirty && !discard) {
      editorGuard.proceed(() => {
        setEditorDirty(false);
        setApplicationDirty(false);
        setSelected(undefined);
        setIsCreating(false);
        void load(offset, filters, true, keepSelected);
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
            accountSetup: filters.accountSetup,
            plan: filters.plan,
            contact: filters.contact,
            archive: filters.archive,
            ...(filters.tag ? { tag: filters.tag } : {}),
          }) +
          (personId ? "&id=" + encodeURIComponent(personId) : ""),
      );
      if (request !== requestSerial.current) return;
      setData(result);
      setSelected((current) =>
        current
          ? result.rows.find((row) => recordKey(row) === recordKey(current)) ??
            (keepSelected ? current : undefined)
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
  const selectedKey = selected ? recordKey(selected) : null;
  async function resolveArchivedRecord(member: Member, action: "restore" | "delete-archived") {
    const restoring = action === "restore";
    if (!restoring && !window.confirm(
      `Delete the archived record for ${member.person.name}? This removes sign-in access and frees the email for reuse. Payment records and history are retained.`,
    )) return;

    setBusy(true);
    setMessage("");
    try {
      await api("/api/staff/member-actions", {
        action,
        personId: member.person_id,
        personVersion: member.person_version,
        version: member.membership_version,
      });
      setChosen((previous) => previous.filter((id) => id !== member.person_id));
      setSelected(undefined);
      await load();
      setMessage(restoring ? "Member record restored." : "Archived member record deleted.");
      createButton.current?.focus();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (selectedKey) detailHeading.current?.focus();
  }, [selectedKey]);
  useEffect(() => {
    let active = true;
    const request = ++requestSerial.current;
    const held =
      new URLSearchParams(location.search).get("invitation") === "held";
    const archiveScope = held ? "all" : "current";
    void api<Register>(
      "/api/staff/members?view=register&records=all&archive=" + archiveScope + "&invitation=" +
        (held ? "held" : "all") +
        (personId ? "&id=" + encodeURIComponent(personId) : ""),
    )
      .then((result) => {
        if (!active || request !== requestSerial.current) return;
        setInvitation(held ? "held" : "all");
        setArchive(archiveScope);
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
        <Link href="/admin/workspaces/members">View all members </Link>
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
            <option value="pending">Pending plan changes</option>
            {plans.map(plan=><option key={plan.code} value={plan.code}>{plan.name}</option>)}
          </select>
        </label>
        <label>
          Invitations
          <select
            value={invitation}
            onChange={(e) => {
              setInvitation(e.target.value);
              if (e.target.value === "held") setArchive("all");
            }}
          >
            <option value="all">All accounts</option>
            <option value="held">Invitations held</option>
          </select>
        </label>
        <label>
          Account setup
          <select value={accountSetup} onChange={(e) => setAccountSetup(e.target.value)}>
            <option value="all">All records</option>
            <option value="active">Active · password set</option>
            <option value="inactive">Inactive · setup pending</option>
          </select>
        </label>
        <button className="button" disabled={busy}>
          Search register
        </button>
        <details className="directory-extra-filters">
          <summary>More filters{archive === "archived" ? " (archived)" : archive === "all" ? " (all records)" : ""}</summary>
          <div className="form-grid">
            <label>
              Archive status
              <select value={archive} onChange={(e) => setArchive(e.target.value)}>
                <option value="current">Current records</option>
                <option value="archived">Archived records</option>
                <option value="all">Current and archived records</option>
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
            {!personId && (
              <label>
                Profile tag
                <select value={tag} onChange={event => {
                  const nextTag = event.target.value;
                  setTag(nextTag);
                  void load(0, { q, status, invitation, accountSetup, plan, contact, archive, tag: nextTag });
                }}>
                  <option value="">All tags</option>
                  {data?.tags?.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
              </label>
            )}
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
                        !m.archived_at &&
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
                              Boolean(m.archived_at) ||
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
                        {m.archived_at && <StatusBadge tone="neutral">Archived</StatusBadge>}
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
                      <StatusBadge tone={m.login_ready ? "success" : "neutral"}>
                        {membershipStatus(m)}
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
                          setAccountSetup("all");
                          setArchive("current");
                          setPlan("all");
                          setContact("all");
                          setTag("");
                          void load(0, {
                            q: "",
                            status: "all",
                            invitation: "all",
                            accountSetup: "all",
                            archive: "current",
                            plan: "all",
                            contact: "all",
                            tag: "",
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
                      accountSetup: "all",
                      plan: "all",
                      contact: "all",
                      archive: "current",
                      tag: "",
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
              <div className={`member-detail-heading ${styles.profileHeading}`}>
                <h3 ref={detailHeading} tabIndex={-1}>
                  {selected.person.name}
                </h3>
                {(selected.type || selected.profile_tags?.length || selected.archived_at) && (
                  <ul className={styles.profileBadges} aria-label="Membership plan and profile tags">
                    {selected.type && (
                      <li className={styles.planBadge}>
                        {plans.find(plan => plan.code === selected.type)?.name ?? selected.type}
                      </li>
                    )}
                    {selected.profile_tags?.map(tag => <li key={tag.id}>{tag.name}</li>)}
                    {selected.archived_at && <li>Archived</li>}
                  </ul>
                )}
              </div>
              <nav className={styles.tabs} aria-label="Member details sections">
                {[
                  "Member details",
                  ...(canManageDetails ? ["Application review"] : []),
                  "Attendance",
                  ...(canManageDetails ? ["Manage membership"] : []),
                  "Tags",
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
              {detailTab === "Tags" && (
                <MemberProfileTags
                  key={recordKey(selected)}
                  assigned={selected.profile_tags ?? []}
                  available={data?.tags ?? []}
                  personId={selected.person_id}
                  userId={selected.user_id}
                  canManage={canManageDetails && Boolean(selected.person_id || selected.user_id)}
                  busy={busy}
                  setBusy={setBusy}
                  onSaved={async tags => {
                    setSelected(current => current && { ...current, profile_tags: tags });
                    await load(0, undefined, false, true);
                  }}
                />
              )}
              {detailTab === "Member details" && (
                <div className={styles.summary}>
                  <div className={styles.contactHeading}>
                    <h4>Contact &amp; membership</h4>
                    {canManage && selected.archived_at && selected.person_id && (
                      <div className={styles.contactActions}>
                        <button type="button" className="button secondary" disabled={busy}
                          onClick={() => void resolveArchivedRecord(selected, "restore")}>
                          Restore member
                        </button>
                        {!selected.protected_account && (
                          <button type="button" className="button danger" disabled={busy}
                            onClick={() => void resolveArchivedRecord(selected, "delete-archived")}>
                            Delete archived record
                          </button>
                        )}
                      </div>
                    )}
                    {canManageDetails && (
                      <div className={styles.contactActions}>
                        {(selected.user_id || selected.person_id) && (
                          <button type="button" className="button secondary" disabled={busy || editorDirty}
                            onClick={() => setDetailTab("Edit details")}>Edit details</button>
                        )}
                        {(selected.record_kind === "account"
                          ? selected.user_id
                          : selected.person_id) && (
                            <button
                              type="button"
                              className="button secondary"
                              disabled={busy || editorDirty}
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    `Delete ${selected.person.name} from the member directory? Their profile will be archived and removed from public view. Their login account, payment records and history will be retained. You can restore the profile from Archived records in the member directory.`,
                                  )
                                )
                                  return;
                                setBusy(true);
                                try {
                                  await api("/api/staff/member-actions", {
                                    action: selected.record_kind === "account" ? "delete-account-record" : "delete",
                                    userId: selected.user_id,
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
                                    "Member archived. You can restore the profile from Archived records.",
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
                      </div>
                    )}
                  </div>
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
                    <dt>Invitation status</dt>
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
                    <dt>Login status</dt>
                    <dd>
                      {selected.user_id ? selected.login_ready ? "Password set" : "Password setup pending" : "No login account"}
                    </dd>
                    <dt>Account created</dt>
                    <dd>{selected.account_created_at ? new Date(selected.account_created_at).toLocaleDateString("en-IN") : "Not applicable"}</dd>
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
                      {membershipStatus(selected)}
                    </dd>
                  </dl>
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
                  {canManageDetails && (
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
                  <h4>Membership plan</h4>
                  {!selected.type && <p>No plan assigned.</p>}
                  {canManageDetails && (selected.person_id || selected.user_id) && (
                        <form className={styles.membershipControls} onSubmit={async event => {
                          event.preventDefault();
                          if (busy || editorDirty) return;
                          const plan = String(new FormData(event.currentTarget).get("plan") ?? "");
                          if (plan === selected.type) return;
                          if (!plans.some(item => item.code === plan)) return;
                          setBusy(true);
                          setMessage("");
                          try {
                            const assigned = await api<{ plan: string; membershipVersion: number }>("/api/staff/member-actions", {
                              action: "membership-plan",
                              userId: selected.user_id,
                              personId: selected.person_id,
                              version: selected.membership_version,
                              onlyIfUnassigned: !selected.type,
                              plan,
                            });
                            setSelected(current => current && {
                              ...current,
                              type: assigned.plan,
                              membership_version: assigned.membershipVersion,
                            });
                            await load(data?.offset ?? 0, undefined, false, true);
                            setMessage("Membership plan saved.");
                          } catch (error) {
                            setMessage((error as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}>
                          <label>
                            Membership plan
                            <select key={selected.type ?? "unassigned"} name="plan" defaultValue={selected.type ?? ""} required disabled={busy || editorDirty}>
                              <option value="" disabled>Choose a plan</option>
                              {plans.map(plan => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
                            </select>
                          </label>
                          <button className="button" type="submit" disabled={busy || editorDirty || plans.length === 0}>{selected.type ? "Save plan" : "Assign plan"}</button>
                        </form>
                  )}
                  {selected.pending_plan && (
                    <form onSubmit={async event => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const decision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
                      setBusy(true);
                      try {
                        await api("/api/staff/member-actions", {
                          action: "review-plan-change",
                          personId: selected.person_id,
                          plan: selected.pending_plan,
                          decision,
                          requirementsConfirmed: form.has("requirements-confirmed"),
                        });
                        await load(data?.offset ?? 0);
                        setSelected(undefined);
                        setMessage(decision === "approve" ? "Plan change approved." : "Plan change declined.");
                      } catch (error) {
                        setMessage((error as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}>
                      <p>Requested plan <strong>{selected.pending_plan}</strong></p>
                      {selected.pending_plan !== "Free" && (
                        <label>
                          <input type="checkbox" name="requirements-confirmed" />
                          I confirmed profile verification and any applicable payment.
                        </label>
                      )}
                      <div className="action-row">
                        <button className="button" type="submit" value="approve" disabled={busy || editorDirty}>Approve plan change</button>
                        <button className="button secondary" type="submit" value="decline" disabled={busy || editorDirty}>Decline</button>
                      </div>
                    </form>
                  )}
                </section>
              )}
              {detailTab === "Member details" && (
                <section className={styles.section}>
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
                  {canManageDetails &&
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
                              accountSetup,
                              plan,
                              contact,
                              archive,
                              tag,
                            },
                            true,
                          );
                        }}
                      />
                    )}
                </section>
              )}
              {canManageDetails &&
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
