"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./operations-client";
import { PublicProfileEditor } from "./public-profile-editor";
import { PublishingGroups } from "./publishing-groups";
import { moveMemberPlacement } from "@/domain/people-placement";
import styles from "./publishing.module.css";
import { PortalIcon } from "./portal-icon";
import { StatusBadge } from "./portal-values";
import type { PersonEntry, ProfileGroup } from "@/domain/people";
import ui from "./communications.module.css";
export type PublishingMembersData = {
  records: PersonEntry[];
  groups: ProfileGroup[];
  portraits: { id: string; title: string }[];
  canReview: boolean;
  canPublish: boolean;
  total: number;
};
export function PublishingMembers({
  initialId,
  onDirty,
}: {
  initialId?: string;
  onDirty?: (dirty: boolean) => void;
}) {
  const [data, setData] = useState<PublishingMembersData>(),
    [selected, setSelected] = useState<PersonEntry | null>(null),
    [editing, setEditing] = useState(false),
    [groupsView, setGroupsView] = useState(false),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("association"),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [moving, setMoving] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    let active = true;
    void api<PublishingMembersData>(
      `/api/staff/governance?page=${page}&filter=${filter}&q=${encodeURIComponent(search)}`,
    )
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [page, filter, search, refresh]);
  useEffect(() => {
    if (!initialId) return;
    let active = true;
    void api<PublishingMembersData>(`/api/staff/governance?id=${initialId}`)
      .then((d) => {
        if (active) {
          setSelected(d.records[0]);
          setEditing(true);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [initialId]);
  async function open(id: string) {
    setError("");
    try {
      const d = await api<PublishingMembersData>(
        `/api/staff/governance?id=${id}`,
      );
      const row = d.records[0];
      if (!row) throw Error("This profile is no longer available.");
      setSelected(row);
      setEditing(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function changeGroup(
    person: PersonEntry,
    index: number,
    groupId: string,
  ) {
    if (!groupId || moving) return;
    setMoving(person.id);
    setError("");
    setNotice("");
    try {
      const previous = person.draft.assignments[index];
      const assignments = previous
        ? moveMemberPlacement(
            person.draft.assignments,
            [previous.groupId],
            groupId,
            previous.order,
          )
        : [
            ...person.draft.assignments,
            { groupId, role: "Member", term: "", order: 0 },
          ];
      const row = await api<PersonEntry>("/api/staff/governance", {
        action: "save",
        id: person.id,
        version: person.version,
        body: { assignments },
      });
      setData((current) =>
        current
          ? {
              ...current,
              records: current.records.map((p) => (p.id === row.id ? row : p)),
            }
          : current,
      );
      setNotice(
        `Group updated for ${person.draft.name}. Saved as a draft; review and publish the profile to update the website.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMoving("");
    }
  }
  function close() {
    setEditing(false);
    onDirty?.(false);
    setRefresh((v) => v + 1);
  }
  if (groupsView && data)
    return (
      <PublishingGroups
        groups={data.groups}
        onDirty={onDirty}
        onClose={() => {
          setGroupsView(false);
          onDirty?.(false);
          setRefresh((v) => v + 1);
        }}
      />
    );
  if (editing && data)
    return (
      <PublicProfileEditor
        key={selected?.id ?? "new"}
        initial={selected}
        data={data}
        onDirty={onDirty}
        onClose={close}
      />
    );
  return (
    <section>
      <header className={ui.sectionHeading}>
        <div>
          <h2>Members & committee</h2>
          <p>Manage the profiles displayed on your website.</p>
        </div>
        {data?.canPublish && (
          <button
            className="button gold"
            onClick={() => {
              setSelected(null);
              setEditing(true);
            }}
          >
            ＋ Add profile
          </button>
        )}
      </header>
      <div className={ui.toolbar}>
        <label className={ui.search}>
          <span className={ui.srOnly}>Search member profiles</span>
          <input
            type="search"
            placeholder="Search name or organisation…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className={ui.filterSelect}>
          <span className={ui.srOnly}>Profile view</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="association">Website profiles</option>
            <option value="published">Published profiles</option>
            <option value="pending">Awaiting review</option>
            <option value="all">All members</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        {data?.canPublish && (
          <button
            className="button secondary"
            onClick={() => setGroupsView(true)}
          >
            Manage groups
          </button>
        )}
      </div>
      <p className={ui.helper}>
        Choose a website group from the dropdown. Group changes save as drafts
        for review and publication.
      </p>
      {notice && (
        <p className={ui.notice} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className={ui.notice} role="alert">
          {error}{" "}
          <button
            className="button secondary"
            onClick={() => setRefresh((v) => v + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading member profiles…</p>
      ) : data && !data.records.length ? (
        <div className={ui.empty}>
          <PortalIcon name="people" />
          <h3>No profiles in this view</h3>
          <p>
            Select All members to find an existing member, or add a new profile
            for the website.
          </p>
        </div>
      ) : data ? (
        <>
          <div
            className={ui.tableWrap}
            role="region"
            aria-label="Website member profiles"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Website group</th>
                  <th>Publication</th>
                  <th>
                    <span className={ui.srOnly}>Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        disabled={!!moving}
                        className={`text-button ${ui.tableLink}`}
                        onClick={() => void open(p.id)}
                      >
                        {p.draft.name}
                      </button>
                      <small>
                        {[p.draft.jobTitle, p.draft.organization]
                          .filter(Boolean)
                          .join(" · ") || p.draft.profession}
                      </small>
                    </td>
                    <td>
                      {data.canPublish && !p.archived_at
                        ? (p.draft.assignments.length
                            ? p.draft.assignments
                            : [null]
                          ).map((assignment, index) => (
                            <label
                              className={styles.groupChoice}
                              key={assignment?.groupId ?? "unassigned"}
                            >
                              <span className={ui.srOnly}>
                                Website group for {p.draft.name}
                                {p.draft.assignments.length > 1
                                  ? ` · placement ${index + 1}`
                                  : ""}
                              </span>
                              <select
                                value={assignment?.groupId ?? ""}
                                disabled={!!moving}
                                onChange={(e) =>
                                  void changeGroup(p, index, e.target.value)
                                }
                              >
                                <option value="" disabled>
                                  Choose a group
                                </option>
                                {data.groups
                                  .filter(
                                    (g) =>
                                      !g.archived ||
                                      g.id === assignment?.groupId,
                                  )
                                  .map((g) => (
                                    <option
                                      key={g.id}
                                      value={g.id}
                                      disabled={
                                        g.archived ||
                                        p.draft.assignments.some(
                                          (a, n) =>
                                            n !== index && a.groupId === g.id,
                                        )
                                      }
                                    >
                                      {g.parent_id
                                        ? `${data.groups.find((parent) => parent.id === g.parent_id)?.draft.name ?? ""} / `
                                        : ""}
                                      {g.draft.name}
                                      {g.archived ? " · Archived" : ""}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          ))
                        : p.draft.assignments
                            .map(
                              (a) =>
                                data.groups.find((g) => g.id === a.groupId)
                                  ?.draft.name,
                            )
                            .filter(Boolean)
                            .join(", ") || "Not placed on a page"}
                      {p.published &&
                        JSON.stringify(p.draft.assignments) !==
                          JSON.stringify(p.published.assignments) && (
                          <small>Group change pending publication</small>
                        )}
                    </td>
                    <td>
                      <StatusBadge
                        tone={
                          p.archived_at
                            ? "neutral"
                            : p.published
                              ? "success"
                              : "pending"
                        }
                      >
                        {p.archived_at
                          ? "Archived"
                          : p.published
                            ? "Published"
                            : "Draft"}
                      </StatusBadge>
                      {p.status === "pending" && <small>Awaiting review</small>}
                    </td>
                    <td>
                      <button
                        className="button secondary"
                        disabled={!!moving}
                        onClick={() => void open(p.id)}
                      >
                        Edit profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(data.total > 50 || page > 1) && (
            <div className={ui.pagination}>
              <span>
                {data.total} profiles · Page {page}
              </span>
              <button
                className="text-button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <button
                className="text-button"
                disabled={page * 50 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : null}
      <p className={ui.helper}>
        Membership, private contact details and account access are managed in
        the <Link href="/admin/workspaces/members">member directory</Link>.
      </p>
    </section>
  );
}
