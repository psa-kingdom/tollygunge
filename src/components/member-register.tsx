"use client";
import { MemberEditor } from "./member-editor";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
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
  const [data, setData] = useState<Register>(),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [busy, setBusy] = useState(false),
    [chosen, setChosen] = useState<string[]>([]),
    [progress, setProgress] = useState(0),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState<Member>();
  async function load(offset = 0) {
    try {
      setData(
        await api<Register>(
          "/api/staff/members?view=register&q=" +
            encodeURIComponent(q) +
            "&status=" +
            status +
            "&offset=" +
            offset,
        ),
      );
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    void api<Register>("/api/staff/members?view=register")
      .then(setData)
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <section>
      <h2>Member register</h2>
      <p>
        Professional members, including people who have no login account.
        Membership and reviewed-profile status are recorded separately.
      </p>
      <form
        className="action-row"
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
        <button className="button" disabled={busy}>
          Search register
        </button>
      </form>
      <p>{data?.total ?? 0} members</p>
      <div className="action-row">
        <Link className="button secondary" href="/admin/workspaces/onboarding">
          Import / retry member records
        </Link>
        <button
          className="button secondary"
          disabled={!canManage || busy || !chosen.length}
          onClick={async () => {
            if (
              !window.confirm(
                `Queue invitations for exactly ${chosen.length} selected members?`,
              )
            )
              return;
            setBusy(true);
            setProgress(0);
            const outcomes: string[] = [];
            for (const [index, personId] of chosen.entries()) {
              try {
                await api("/api/staff/member-actions", {
                  action: "invite",
                  personId,
                });
                outcomes.push("Invitation queued");
              } catch (e) {
                outcomes.push((e as Error).message);
              }
              setProgress(index + 1);
            }
            await load();
            setChosen([]);
            setMessage(outcomes.join(" · "));
            setBusy(false);
          }}
        >
          Invite {chosen.length} selected members
        </button>
      </div>
      {busy && (
        <p role="status">
          Processed {progress} of {chosen.length}. You can keep this page open
          while requests complete.
        </p>
      )}
      <div className="directory-list">
        {data?.rows.map((m) => (
          <div key={m.person_id}>
            <label>
              <input
                type="checkbox"
                disabled={!canManage || busy || !!m.user_id}
                checked={chosen.includes(m.person_id)}
                onChange={(e) =>
                  setChosen((old) =>
                    e.target.checked
                      ? [...old, m.person_id]
                      : old.filter((id) => id !== m.person_id),
                  )
                }
              />
              Select {m.person.name}
            </label>
            <button
              type="button"
              className="button secondary"
              key={m.person_id}
              onClick={() => setSelected(m)}
            >
              {m.person.name} · {m.membership_number} ·{" "}
              {m.user_id ? "Account linked" : "No account"}
            </button>
          </div>
        ))}
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
        <section aria-label="Member details">
          <h3>{selected.person.name}</h3>
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
            <button
              className="button secondary"
              disabled={
                !canManage ||
                busy ||
                ["accepted", "active account"].includes(
                  selected.invitation_status,
                )
              }
              onClick={async () => {
                if (
                  !window.confirm(
                    `Queue ${selected.invitation_status === "invitation held" ? "the held" : selected.user_id ? "a replacement" : "an"} invitation for ${selected.person.name}?`,
                  )
                )
                  return;
                setBusy(true);
                try {
                  await api("/api/staff/member-actions", {
                    personId: selected.person_id,
                    action:
                      selected.invitation_status === "invitation held"
                        ? "release"
                        : selected.user_id
                          ? "resend"
                          : "invite",
                  });
                  setMessage("Invitation queued.");
                  await load();
                  setSelected(undefined);
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {selected.invitation_status === "invitation held"
                ? "Release invitation"
                : selected.user_id
                  ? "Resend invitation"
                  : "Invite member"}
            </button>
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
