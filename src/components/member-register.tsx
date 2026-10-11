"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
type Member = {
  person_id: string;
  user_id: string | null;
  person: {
    name: string;
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
export function MemberRegister() {
  const [data, setData] = useState<Register>(),
    [q, setQ] = useState(""),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState<Member>();
  async function load(offset = 0) {
    try {
      setData(
        await api<Register>(
          "/api/staff/members?view=register&q=" +
            encodeURIComponent(q) +
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
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button className="button">Search register</button>
      </form>
      <p>{data?.total ?? 0} members</p>
      <div className="directory-list">
        {data?.rows.map((m) => (
          <button
            type="button"
            className="button secondary"
            key={m.person_id}
            onClick={() => setSelected(m)}
          >
            {m.person.name} · {m.membership_number} ·{" "}
            {m.user_id ? "Account linked" : "No account"}
          </button>
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
            <dt>Reviewed profile</dt>
            <dd>
              {selected.professional_verified ? "Verified" : "Unverified"}
            </dd>
          </dl>
          <details>
            <summary>Recorded addresses</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(selected.person.addresses ?? {}, null, 2)}
            </pre>
          </details>
          <a
            className="button secondary"
            href={"/admin/workspaces/governance?id=" + selected.person_id}
          >
            Open profile
          </a>
        </section>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
