"use client";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import type { StaffRole } from "@/domain/access";
type Person = {
  id: string;
  name: string;
  email: string;
  roles: StaffRole[];
  eligible: boolean;
};
type Directory = {
  people: Person[];
  actorId: string;
  roles: StaffRole[];
  limited: boolean;
};
type Entry = {
  id: string;
  action: string;
  entity_id: string;
  created_at: string;
  actor_name: string | null;
};
type Audit = { entries: Entry[]; next: string | null };
export function StaffAccess() {
  const [directory, setDirectory] = useState<Directory>(),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Person>(),
    [chosen, setChosen] = useState<StaffRole[]>([]),
    [message, setMessage] = useState("Loading staff access…"),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<Audit>(),
    [cursors, setCursors] = useState<(string | null)[]>([null]);
  useEffect(() => {
    Promise.all([
      api<Directory>("/api/staff/access"),
      api<Audit>("/api/staff/audit"),
    ])
      .then(([people, logs]) => {
        setDirectory(people);
        setHistory(logs);
        setMessage("");
      })
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <>
      <p>
        Assign responsibilities to existing verified accounts. Changing roles
        signs that account out everywhere. Account access and association
        membership are separate.
      </p>
      <form
        className="member-settings"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            setDirectory(
              await api<Directory>(
                `/api/staff/access?q=${encodeURIComponent(search)}`,
              ),
            );
            setSelected(undefined);
            setMessage("");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Search failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Search accounts by name or email
          <input
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button className="button secondary" disabled={busy}>
          Search accounts
        </button>
      </form>
      <div className="operations-layout">
        <aside className="record-list" aria-label="Accounts">
          {directory?.people.map((person) => (
            <button
              key={person.id}
              disabled={busy}
              onClick={() => {
                setSelected(person);
                setChosen([...person.roles]);
                setMessage("");
              }}
            >
              <strong>{person.name}</strong>
              <small>{person.email}</small>
              <small>
                {person.roles.length
                  ? person.roles.map((r) => r.replaceAll("_", " ")).join(", ")
                  : "No staff roles"}
              </small>
            </button>
          ))}
          {directory && !directory.people.length && (
            <p>No matching accounts.</p>
          )}
          {directory?.limited && (
            <p>Showing the first 50 accounts. Refine your search.</p>
          )}
        </aside>
        <section>
          {selected ? (
            <form
              className="member-settings"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const result = await api<{ changed: boolean }>(
                    "/api/staff/access",
                    {
                      id: selected.id,
                      expectedRoles: selected.roles,
                      roles: chosen,
                    },
                  );
                  setSelected({ ...selected, roles: [...chosen].sort() });
                  setDirectory(
                    await api<Directory>(
                      `/api/staff/access?q=${encodeURIComponent(search)}`,
                    ),
                  );
                  setHistory(await api<Audit>("/api/staff/audit"));
                  setCursors([null]);
                  setMessage(
                    result.changed
                      ? "Access updated. Account sessions revoked."
                      : "No access changes to save.",
                  );
                } catch (e) {
                  setMessage(e instanceof Error ? e.message : "Save failed.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>{selected.name}</h2>
              <p>{selected.email}</p>
              {selected.id === directory?.actorId && (
                <p className="notice">
                  Another administrator must change your access.
                </p>
              )}
              {!selected.eligible && (
                <p className="notice">
                  This account must verify its identity before receiving staff
                  access.
                </p>
              )}
              <fieldset
                disabled={
                  busy ||
                  selected.id === directory?.actorId ||
                  (!selected.eligible && !selected.roles.length)
                }
              >
                <legend>Staff responsibilities</legend>
                {directory?.roles.map((role) => (
                  <label className="check-label" key={role}>
                    <input
                      type="checkbox"
                      disabled={!selected.eligible && !chosen.includes(role)}
                      checked={chosen.includes(role)}
                      onChange={(e) =>
                        setChosen(
                          e.target.checked
                            ? [...chosen, role]
                            : chosen.filter((r) => r !== role),
                        )
                      }
                    />
                    {role.replaceAll("_", " ")}
                  </label>
                ))}
              </fieldset>
              <button
                className="button"
                disabled={
                  busy ||
                  selected.id === directory?.actorId ||
                  (!selected.eligible && chosen.length > 0)
                }
              >
                Save access and revoke sessions
              </button>
            </form>
          ) : (
            <p>Select an account to inspect its responsibilities.</p>
          )}
        </section>
      </div>
      <p role="status">{message}</p>
      <section className="content-section">
        <h2>Administrative activity</h2>
        <p>
          Recent consequential actions. Private document contents and
          credentials are excluded.
        </p>
        {history?.entries.length ? (
          <div className="table-scroll">
            <table className="operations-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {history.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.created_at).toLocaleString()}</td>
                    <td>
                      {entry.actor_name ??
                        (entry.action === "inquiry.public_created"
                          ? "Public website visitor"
                          : "Removed account")}
                    </td>
                    <td>{entry.action}</td>
                    <td>{entry.entity_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No recorded actions.</p>
        )}
        <div className="action-row">
          <button
            className="button secondary"
            disabled={busy || cursors.length < 2}
            onClick={async () => {
              setBusy(true);
              try {
                const stack = cursors.slice(0, -1),
                  cursor = stack.at(-1);
                setHistory(
                  await api<Audit>(
                    `/api/staff/audit${cursor ? `?before=${cursor}` : ""}`,
                  ),
                );
                setCursors(stack);
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Load failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Newer actions
          </button>
          <button
            className="button secondary"
            disabled={busy || !history?.next}
            onClick={async () => {
              setBusy(true);
              try {
                const cursor = history!.next!;
                setHistory(
                  await api<Audit>(`/api/staff/audit?before=${cursor}`),
                );
                setCursors([...cursors, cursor]);
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Load failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Older actions
          </button>
        </div>
      </section>
    </>
  );
}
