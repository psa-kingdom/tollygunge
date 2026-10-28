"use client";
import { WorkspaceEmptyState } from "./workspace-ui";
import { useEffect, useState, useRef } from "react";
import { api } from "./operations-client";
import { PersonEditor } from "./person-editor";
import { useUnsavedProfile } from "./use-unsaved-profile";
import type { PersonEntry, ProfileGroup } from "@/domain/people";
type Data = {
  records: PersonEntry[];
  groups: ProfileGroup[];
  portraits: { id: string; title: string }[];
  canReview: boolean;
  canEditPrivate: boolean;
  canPublish: boolean;
  total: number; page:number; pageSize:number;
  biographyTemplate:string;
};
const emptyGroup = { name: "", page: "governance", section: 0, order: 0 };
export function GovernanceWorkspace() {
  const [data, setData] = useState<Data>(),
    [selected, setSelected] = useState<PersonEntry | null>(null),
    [tab, setTab] = useState("people"),
    [dirty, setDirty] = useState(false),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState("all"),
    [message, setMessage] = useState("Loading people…");
  const { guard, dialog } = useUnsavedProfile(dirty, false);
  const [page,setPage]=useState(1),[search,setSearch]=useState("");
  const initialized=useRef(false);
  const directoryUrl=`/api/staff/governance?page=${page}&filter=${filter}&q=${encodeURIComponent(search)}`;
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(q);setPage(1);},300);return()=>clearTimeout(timer);},[q]);
  const [group, setGroup] = useState<ProfileGroup | null>(null),
    [body, setBody] = useState(emptyGroup),
    [parent, setParent] = useState(""),
    [groupBusy, setGroupBusy] = useState(false);
  const groupDirty =
    JSON.stringify(body) !== JSON.stringify(group?.draft ?? emptyGroup) ||
    parent !== (group?.parent_id ?? "");
  const { guard: groupGuard, dialog: groupDialog } =
    useUnsavedProfile(groupDirty);
  async function load() {
    const d = await api<Data>(directoryUrl);
    setData(d);
    setMessage("");
    return d;
  }
  useEffect(() => {
    let active = true;
    api<Data>(directoryUrl)
      .then((d) => {
        if (active) {
          setData(d);
          setMessage("");
          if (initialized.current) return;
          initialized.current=true;
          const params = new URLSearchParams(window.location.search);
          if (params.get("review") === "pending") setFilter("pending");
          const id = params.get("id");
          if (id) {
            setFilter("all");
            void api<Data>(`/api/staff/governance?id=${encodeURIComponent(id)}`)
              .then((v) => {
                if (active) setSelected(v.records[0] ?? null);
              })
              .catch((e) => {
                if (active) setMessage(e.message);
              });
          }
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [directoryUrl]);
  async function openPerson(p: PersonEntry) {
    try {
      const details = await api<Data>(`/api/staff/governance?id=${p.id}`);
      setSelected(details.records[0]);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function groupAction(action: string) {
    setGroupBusy(true);
    try {
      const row = await api<ProfileGroup>("/api/staff/profile-groups", {
        action,
        id: group?.id,
        version: group?.version ?? 0,
        body,
        parentId: parent || null,
      });
      setGroup(row);
      setBody(row.draft);
      setParent(row.parent_id ?? "");
      await load();
      setMessage(
        action === "save"
          ? "Group draft saved. Publish to update public placement."
          : `Group ${action} completed.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setGroupBusy(false);
    }
  }
  return (
    <>
      <p>
        One person, multiple responsibilities. Personal verification and public
        publication are separate.
      </p>
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label="People workspace"
      >
        {["people", ...(data?.canPublish ? ["groups"] : [])].map((t) => (
          <button
            className={tab === t ? "selected" : ""}
            role="tab"
            aria-selected={tab === t}
            key={t}
            onClick={() =>
              guard(() =>
                groupGuard(() => {
                  setTab(t);
                  setDirty(false);
                  setBody(group?.draft ?? emptyGroup);
                  setParent(group?.parent_id ?? "");
                }),
              )
            }
          >
            {t === "people" ? "People & reviews" : "Groups & subgroups"}
          </button>
        ))}
      </div>
      {tab === "people" && data && (
        <>
          <div className="profile-list-controls">
            <label>
              Find people
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, organization or role"
              />
            </label>
            <label>
              Show
              <select
                value={filter}
                onChange={(e) => {setFilter(e.target.value);setPage(1);}}
              >
                <option value="all">All people</option>
                <option value="association">Committee profiles</option>
                <option value="published">Published profiles</option>
                <option value="archived">Archived profiles</option>
                <option value="pending">Pending admin review</option>
                <option value="unverified">Unverified</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          </div>
          <p role="status">{data.total} people · Page {page} of {Math.max(1,Math.ceil(data.total/50))}</p>
          <div className="action-row"><button className="button secondary" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous people</button><button className="button secondary" disabled={page*50>=data.total} onClick={()=>setPage(page+1)}>Next people</button></div>
          <div className="content-workspace">
            <aside className="record-list">
              <button
                className="button secondary"
                onClick={() => guard(() => setSelected(null))}
              >
                New person
              </button>
              {!data.records.length && <WorkspaceEmptyState compact icon="people" title="No people match" description="Change the search or view filter to find a profile." />}
              {data.records.map((p) => (
                  <button
                    key={p.id}
                    className={selected?.id === p.id ? "selected" : ""}
                    onClick={() =>
                      guard(() => {
                        void openPerson(p);
                      })
                    }
                  >
                    <strong>{p.draft.name}</strong>
                    <small>
                      {p.archived_at ? "Archived" : p.status === "pending" ? "Pending review" : p.status} ·{" "}
                      {p.published ? "Published" : "Private"}
                    </small>
                  </button>
                ))}
            </aside>
            <div className="content-editing-area">
              {selected && <div className="action-row">{data.canEditPrivate && (selected.membership_id ? <a className="text-link" href={`/admin/workspaces/members?personId=${selected.id}`}>View member record →</a> : selected.user_id ? <a className="text-link" href={`/admin/workspaces/members?id=${selected.user_id}`}>View account record →</a> : <span>No linked membership or account</span>)}{data.canPublish && <button className="button secondary" disabled={dirty} onClick={()=>guard(()=>{void api<PersonEntry>("/api/staff/governance",{action:selected.archived_at?"restore":"archive",id:selected.id,version:selected.version}).then(row=>{setSelected(row);return load();}).catch(e=>setMessage(e.message));})}>{selected.archived_at?"Restore profile":"Archive profile"}</button>}</div>}
              {selected?.archived_at ? <p className="notice">This profile is archived and private. Restore it before editing; its membership and account remain intact.</p> : <PersonEditor
                key={selected?.id ?? "new"}
                entry={selected}
                groups={data.groups}
                editorial={data.portraits}
                canReview={data.canReview}
                biographyTemplate={data.biographyTemplate}
                canPublish={data.canPublish}
                canEditPrivate={data.canEditPrivate}
                onDirty={setDirty}
                onSaved={(row) => {
                  setSelected(row);
                  void load().catch((e) => setMessage(e.message));
                }}
              />}
            </div>
          </div>
        </>
      )}
      {tab === "groups" && data && (
        <div className="operations-layout">
          <aside className="record-list">
            <button
              className="button secondary"
              onClick={() =>
                groupGuard(() => {
                  setGroup(null);
                  setBody(emptyGroup);
                  setParent("");
                })
              }
            >
              New group
            </button>
            {!data.groups.length && <WorkspaceEmptyState compact icon="people" title="No groups yet" description="Create a committee or group using the editor." />}
            {data.groups.map((g) => (
              <button
                key={g.id}
                className={group?.id === g.id ? "selected" : ""}
                onClick={() =>
                  groupGuard(() => {
                    setGroup(g);
                    setBody(g.draft);
                    setParent(g.parent_id ?? "");
                  })
                }
              >
                <strong>
                  {g.parent_id ? "↳ " : ""}
                  {g.draft.name}
                </strong>
                <small>
                  {g.archived
                    ? "Archived"
                    : g.published
                      ? "Published"
                      : "Draft"}
                </small>
              </button>
            ))}
          </aside>
          <section>
            <h2>{group ? "Edit group" : "Create group"}</h2>
            <p>
              Top-level groups choose a public section. Subgroups inherit their
              parent’s placement. Existing navigation stays intact.
            </p>
            <form
              className="member-settings"
              onSubmit={(e) => {
                e.preventDefault();
                void groupAction("save");
              }}
            >
              <fieldset className="plain-fieldset" disabled={groupBusy}>
                <label>
                  Group name
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={body.name}
                    onChange={(e) => setBody({ ...body, name: e.target.value })}
                  />
                </label>
                <label>
                  Parent group
                  <select
                    value={parent}
                    onChange={(e) => setParent(e.target.value)}
                  >
                    <option value="">Top-level group</option>
                    {data.groups
                      .filter(
                        (g) =>
                          !g.parent_id && !g.archived && g.id !== group?.id,
                      )
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.draft.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Public page
                  <select
                    disabled={!!parent}
                    value={body.page}
                    onChange={(e) => setBody({ ...body, page: e.target.value })}
                  >
                    <option value="about">About</option>
                    <option value="governance">Governance</option>
                  </select>
                </label>
                <label>
                  Section
                  <select
                    disabled={!!parent}
                    value={body.section}
                    onChange={(e) =>
                      setBody({ ...body, section: Number(e.target.value) })
                    }
                  >
                    {(body.page === "about"
                      ? ["About TPA", "Vision & Mission", "Founding Members"]
                      : ["Executive Committee", "Sub-Committees", "Governance"]
                    ).map((n, i) => (
                      <option key={i} value={i}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Display order
                  <input
                    type="number"
                    required
                    min={0}
                    max={999}
                    value={body.order}
                    onChange={(e) =>
                      setBody({ ...body, order: Number(e.target.value) })
                    }
                  />
                </label>
                <div className="action-row">
                  <button className="button">Save group draft</button>
                  {group && (
                    <>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={groupDirty || group.archived}
                        onClick={() => void groupAction("publish")}
                      >
                        Publish saved group
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={groupDirty}
                        onClick={() =>
                          void groupAction(
                            group.archived ? "restore" : "archive",
                          )
                        }
                      >
                        {group.archived ? "Restore group" : "Archive group"}
                      </button>
                    </>
                  )}
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      )}
      <p role="status">{message}</p>
      {dialog}
      {groupDialog}
    </>
  );
}
