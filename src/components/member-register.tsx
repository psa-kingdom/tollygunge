"use client";
import { MemberEditor } from "./member-editor";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { api } from "./operations-client";
import {InvitationReleaseReview} from "./invitation-release-review";
import { PortalIcon } from "./portal-icon";
import { WorkspaceEmptyState } from "./workspace-ui";
type Member = {
  person_id: string;
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
  membership_number: string;
  type: string | null;
  status: string | null;
  professional_verified: boolean;
  email_verified: boolean | null;
};
type Register = {
  rows: Member[];
  total: number;
  offset: number;
  pageSize: number;
};
export function MemberRegister({ canManage = false }: { canManage?: boolean }) {
  const personId=useSearchParams().get("personId");
  const [data, setData] = useState<Register>(),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [busy, setBusy] = useState(false),
    [chosen, setChosen] = useState<string[]>([]),
    [invitation, setInvitation] = useState("all"),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState<Member>();
  async function load(offset = 0, filters = { q, status, invitation }) {
    const request = ++requestSerial.current;
    try {
      const result = await api<Register>(
          "/api/staff/members?view=register&q=" +
            encodeURIComponent(filters.q) +
            "&status=" +
            filters.status +
            "&offset=" +
            offset+"&invitation="+filters.invitation+(personId?"&id="+encodeURIComponent(personId):""),
        );
      if (request !== requestSerial.current) return;
      setData(result);
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
    const held=new URLSearchParams(location.search).get("invitation")==="held";
    void api<Register>("/api/staff/members?view=register&invitation="+(held?"held":"all")+(personId?"&id="+encodeURIComponent(personId):""))
      .then(result=>{if(!active || request !== requestSerial.current)return;setInvitation(held?'held':'all');setData(result);if(personId)setSelected(result.rows[0]);})
      .catch((e) => {if(active && request === requestSerial.current)setMessage(e.message);});
    return () => { active = false; };
  }, [personId]);
  return (
    <section className="member-register-workspace">
      <h2 className="sr-only">Member register</h2>
      {personId && <Link href="/admin/workspaces/members">View all members →</Link>}
      <p>
        Professional members, including people who have no login account.
        Membership and reviewed-profile status are recorded separately.
      </p>
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
            placeholder="Name, membership number, email or mobile"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
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
        <label>Invitations<select value={invitation} onChange={e=>setInvitation(e.target.value)}><option value="all">All accounts</option><option value="held">Invitations held</option></select></label>
        <button className="button" disabled={busy}>
          Search register
        </button>
      </form>
      <div className="member-register-resultbar">
      <p>{data ? `${data.total} members` : "Loading members…"}</p>
        <Link className="button secondary" href="/admin/workspaces/onboarding">
          Import / retry member records
        </Link>
      </div>
      <div className="member-register-bulk">
      <InvitationReleaseReview personIds={chosen} canManage={canManage} onComplete={()=>{void load();setChosen([]);}} />
      <button className="button secondary" disabled={!canManage || busy} onClick={()=>setChosen(old=>[...new Set([...old,...(data?.rows??[]).filter(m=>m.user_id && !['accepted','active account'].includes(m.invitation_status)).map(m=>m.person_id)])])}>Select eligible accounts on this page</button>
      </div>
      <div className="table-wrap member-register-table" role="region" aria-label="Member register records" tabIndex={0}>
        <table className="operations-table">
          <thead><tr><th scope="col"><span className="sr-only">Select member</span></th><th scope="col">Member</th><th scope="col">Membership no.</th><th scope="col">Status</th><th scope="col">Account</th></tr></thead>
          <tbody>
        {data?.rows.map((m) => (
          <tr key={m.person_id} className={selected?.person_id === m.person_id ? "is-selected" : ""}>
            <td><label className="member-register-select">
              <input
                type="checkbox"
                disabled={!canManage || busy || !m.user_id || ["accepted","active account"].includes(m.invitation_status)}
                checked={chosen.includes(m.person_id)}
                onChange={(e) =>
                  setChosen((old) =>
                    e.target.checked
                      ? [...old, m.person_id]
                      : old.filter((id) => id !== m.person_id),
                  )
                }
              />
              <span className="sr-only">Select {m.person.name}</span>
            </label></td>
            <td>
            <button
              type="button"
              className="link-button member-record-button"
              aria-label={`${m.person.name} · ${m.membership_number} · ${m.user_id ? "Account linked" : "No account"}`}
              aria-expanded={selected?.person_id === m.person_id}
              aria-controls={selected?.person_id === m.person_id ? "member-register-detail" : undefined}
              onClick={(event) => { selectedButton.current = event.currentTarget; setSelected(m); }}
            >
              <span className="member-record-avatar" aria-hidden="true">{m.person.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("")}</span>
              <span className="member-record-identity"><strong>{m.person.name}</strong><small>{m.email || "No email recorded"}</small></span>
              <PortalIcon name="chevron" />
            </button>
            </td>
            <td>{m.membership_number}</td>
            <td><span className={`member-register-status ${m.status === "active" ? "is-active" : ""}`}>{m.status || "Not recorded"}</span></td>
            <td><span className="member-register-account">{m.user_id ? "Account linked" : "No account"}</span></td>
          </tr>
        ))}
          {data && !data.rows.length && <tr><td colSpan={5} className="member-register-empty"><WorkspaceEmptyState icon="people" title="No members match these filters" description="Try another search or reset the filters to browse the member register." actionLabel="Reset member filters" onAction={() => {setQ("");setStatus("all");setInvitation("all");void load(0,{q:"",status:"all",invitation:"all"});}} /></td></tr>}
          </tbody>
        </table>
      </div>
      {data && (
        <div className="action-row">
          <button
            disabled={!data.offset}
            onClick={() => void load(Math.max(0, data.offset - data.pageSize))}
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
      {selected && (
        <section id="member-register-detail" className="member-register-detail" aria-label="Member details">
          <div className="member-detail-heading">
            <h3 ref={detailHeading} tabIndex={-1}>{selected.person.name}</h3>
            <button type="button" className="button secondary" onClick={() => { setSelected(undefined); selectedButton.current?.focus(); }}>Close details</button>
          </div>
          <dl>
            <dt>Membership number</dt>
            <dd>{selected.membership_number}</dd>
            <dt>Email</dt>
            <dd>{selected.email}</dd>
            <dt>Mobile</dt>
            <dd>{selected.mobile || "Not supplied"}</dd>
            <dt>Organization</dt>
            <dd>{selected.person.organization || "Not supplied"}</dd>
            <dt>Designation</dt>
            <dd>{selected.person.jobTitle || "Not supplied"}</dd>
            <dt>Membership plan</dt>
            <dd>{selected.type || "Not recorded"}</dd>
            <dt>Membership status</dt>
            <dd>{selected.status || "Not recorded"}</dd>
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
            <dd>{selected.user_id ? "Linked account" : "No login account"}</dd>
            <dt>Pending event payments</dt>
            <dd>
              {selected.pending_payments}{" "}
              <Link href="/admin/workspaces/payments">Inspect payments</Link>
            </dd>
            <dt>Reviewed profile</dt>
            <dd>
              {selected.professional_verified ? "Verified" : "Unverified"}
            </dd>
          </dl>
          <div className="action-row">
            <button className="button secondary" disabled={!canManage || busy || !selected.user_id || ["accepted","active account"].includes(selected.invitation_status)} onClick={()=>{setChosen([selected.person_id]);setSelected(undefined);}}>Review this member invitation</button>
            <label>
              Membership status
              <select
                value={selected.status || "unknown"}
                disabled={!canManage || busy}
                onChange={async (e) => {
                  const next = e.target.value;
                  if (
                    !window.confirm(
                      `Change ${selected.person.name}'s membership to ${next}?`,
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await api("/api/staff/member-actions", {
                      action: "membership",
                      personId: selected.person_id,
                      version: selected.membership_version,
                      status: next,
                    });
                    await load();
                    setSelected(undefined);
                    setMessage("Membership status saved.");
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <option value="unknown" disabled>
                  Not recorded
                </option>
                {["active", "expired", "suspended", "resigned"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          {canManage && (
            <MemberEditor
              key={selected.person_id + selected.person_version}
              member={selected}
              onSaved={() => {
                void load();
                setSelected(undefined);
              }}
            />
          )}
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
          <Link
            className="button secondary"
            href={"/admin/workspaces/governance?id=" + selected.person_id}
          >
            Open profile
          </Link>
        </section>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
