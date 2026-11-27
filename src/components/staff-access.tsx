"use client";
import { CopyValue, StatusBadge } from "./portal-values";
import { WorkspacePanel, WorkspaceEmptyState } from "./workspace-ui";
import { PortalIcon } from "./portal-icon";
import { useUnsavedProfile } from "./use-unsaved-profile";
import ui from "./communications.module.css";
import styles from "./settings-workspace.module.css";
import { useEffect, useState } from "react";
import { api } from "./operations-client";
import { staffRoleLabel, type StaffRole } from "@/domain/access";
type Person = {
  id: string;
  name: string;
  email: string;
  roles: StaffRole[];
  eligible: boolean;
  verified: boolean;
};
type Directory = {
  canCreateSuperAdmin: boolean;
  canManageRoles: boolean;
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
const roleDescriptions: Record<string, string> = {
  administrator:
    "Manage operations across members, content, events, communications and finance.",
  membership_reviewer:
    "Review applications, member records and private documents.",
  content_editor:
    "Edit and publish website pages, articles and public profiles.",
  event_operator: "Manage events, registrations and attendance.",
  communications_operator: "Manage campaigns, conversations and inquiries.",
  finance_operator:
    "Manage collection accounts and verify member payment receipts.",
};
export function StaffAccess() {
  const [directory, setDirectory] = useState<Directory>(),
    [search, setSearch] = useState(""),
    [appliedSearch, setAppliedSearch] = useState(""),
    [selected, setSelected] = useState<Person>(),
    [chosen, setChosen] = useState<StaffRole[]>([]),
    [message, setMessage] = useState("Loading staff access…"),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<Audit>(),
    [cursors, setCursors] = useState<(string | null)[]>([null]);
  const dirty =
    !!selected &&
    JSON.stringify([...chosen].sort()) !==
      JSON.stringify([...selected.roles].sort());
  const { guard, dialog } = useUnsavedProfile(dirty);
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
    <section>
      <header className={ui.sectionHeading}>
        <div>
          <h2>Staff access</h2>
          <p>Manage who can use your admin workspaces and what they can do.</p>
        </div>
      </header>
      {!selected ? (
        <>
          {directory && !directory.canManageRoles && (
            <p className={styles.readOnly}>
              You can view staff access. Only the super admin can change staff
              responsibilities.
            </p>
          )}
          <form
            className={styles.search}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                setDirectory(
                  await api<Directory>(
                    `/api/staff/access?q=${encodeURIComponent(search)}`,
                  ),
                );
                setAppliedSearch(search.trim());
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
              Find an existing account
              <input
                maxLength={120}
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button className="button secondary" disabled={busy}>
              <PortalIcon name="search" />
              Search
            </button>
          </form>
          <div className={ui.toolbar}>
            <h3 style={{ margin: 0, fontSize: 14 }}>
              {appliedSearch ? "Matching accounts" : "Current staff"}
              <span className={ui.count}>
                {directory?.people.length ?? "—"}
              </span>
            </h3>
            <span className={styles.helper}>
              Search to find accounts outside the current team.
            </span>
          </div>
          <div
            className={ui.tableWrap}
            role="region"
            aria-label="Staff accounts"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Responsibilities</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {directory?.people.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <div className={styles.account}>
                        <span>
                          <PortalIcon name="profile" />
                        </span>
                        <div>
                          <strong>
                            {person.name}
                            {person.id === directory.actorId ? " (you)" : ""}
                          </strong>
                          <small>{person.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {person.roles.length
                        ? person.roles
                            .map((role) => staffRoleLabel(role))
                            .join(", ")
                        : "No staff access"}
                    </td>
                    <td>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => {
                          setSelected(person);
                          setChosen([...person.roles]);
                          setMessage("");
                        }}
                        aria-label={`View access for ${person.name}`}
                      >
                        View access
                        <PortalIcon name="chevron" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {directory && !directory.people.length && (
              <WorkspaceEmptyState
                compact
                icon="people"
                title="No matching accounts"
                description="Try a different name or email address."
              />
            )}
            {directory?.limited && (
              <p>Showing the first 50 accounts. Refine your search.</p>
            )}
          </div>
        </>
      ) : (
        <section className={styles.panel}>
          <div className={styles.editorHeader}>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() =>
                guard(() => {
                  setSelected(undefined);
                  setMessage("");
                })
              }
            >
               All staff
            </button>
            <StatusBadge tone={selected.eligible ? "success" : "pending"}>
              {selected.eligible ? "Verified account" : "Verification needed"}
            </StatusBadge>
          </div>
          <form
            className={`member-settings ${styles.form}`}
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
                    `/api/staff/access?q=${encodeURIComponent(appliedSearch)}`,
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
            <p>
              <CopyValue value={selected.email} />
            </p>
            {selected.roles.includes("super_administrator") ? (
              <p className={styles.readOnly}>
                Super-admin access is managed through operator setup. It cannot
                be changed here.
              </p>
            ) : selected.id === directory?.actorId ? (
              <p className={styles.readOnly}>
                Another authorized administrator must change your access.
              </p>
            ) : (
              !directory?.canManageRoles && (
                <p className={styles.readOnly}>
                  Only the super admin can change staff responsibilities.
                </p>
              )
            )}
            {!selected.eligible && (
              <p className="notice">
                This account must verify its identity before receiving staff
                access.
              </p>
            )}
            {directory?.canCreateSuperAdmin && (
              <details className={styles.section}>
                <summary>Initial super admin setup</summary>
                <p>
                  The super admin manages staff roles and reviews financial
                  submissions. You can assign one verified account during
                  initial setup.
                </p>
                <button
                  type="button"
                  className="button"
                  disabled={busy || !selected.verified}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api("/api/staff/access", {
                        action: "create_super_admin",
                        id: selected.id,
                      });
                      setDirectory(await api<Directory>("/api/staff/access"));
                      setSelected(undefined);
                      setMessage(
                        "Super admin assigned. That account must sign in again.",
                      );
                    } catch (e) {
                      setMessage((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Make this account super admin
                </button>
              </details>
            )}
            <fieldset
              className={styles.roleList}
              disabled={
                !directory?.canManageRoles ||
                busy ||
                selected.roles.includes("super_administrator") ||
                selected.id === directory?.actorId ||
                (!selected.eligible && !selected.roles.length)
              }
            >
              <legend>Staff responsibilities</legend>
              {directory?.roles
                .filter((role) => role !== "super_administrator")
                .map((role) => (
                  <label className={`check-label ${styles.role}`} key={role}>
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
                    <span>
                      <strong>{staffRoleLabel(role)}</strong>
                      <small>{roleDescriptions[role]}</small>
                    </span>
                  </label>
                ))}
            </fieldset>
            <div className={styles.formFooter}>
              <p>
                Saving access changes signs this account out on all devices.
              </p>
              <button
                className="button gold"
                disabled={
                  !directory?.canManageRoles ||
                  busy ||
                  !dirty ||
                  selected.roles.includes("super_administrator") ||
                  selected.id === directory?.actorId ||
                  (!selected.eligible && chosen.length > 0)
                }
              >
                {busy ? "Saving…" : "Save access changes"}
              </button>
            </div>
          </form>
        </section>
      )}
      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}
      <details className={styles.activity}>
        <summary>
          <PortalIcon name="shield" />
          Administrative activity
        </summary>
        <WorkspacePanel
          title="Access & administrative history"
          className="content-section"
        >
          <p>
            Recent consequential actions. Private document contents and
            credentials are excluded.
          </p>
          {history?.entries.length ? (
            <div
              className="table-scroll"
              role="region"
              aria-label="Administrative activity"
              tabIndex={0}
            >
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
            <WorkspaceEmptyState
              compact
              icon="shield"
              title="No recorded actions"
              description="Staff access changes and other administrative actions will appear here."
            />
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
        </WorkspacePanel>
      </details>
      {dialog}
    </section>
  );
}
