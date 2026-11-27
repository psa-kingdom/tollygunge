"use client";

import { useRef, useState } from "react";
import { api } from "./operations-client";
import styles from "./member-review.module.css";

export type ProfileTag = { id: string; name: string };

export function MemberProfileTags({
  assigned, available, personId, userId, canManage, busy, setBusy, onSaved,
}: {
  assigned: ProfileTag[];
  available: ProfileTag[];
  personId: string | null;
  userId: string | null;
  canManage: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onSaved: (tags: ProfileTag[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const newName = name.trim().replace(/\s+/g, " ");
  const term = newName.toLowerCase();
  const assignedIds = new Set(assigned.map(tag => tag.id));
  const results = available.filter(tag =>
    !assignedIds.has(tag.id) && tag.name.toLowerCase().includes(term),
  );
  const canCreate = Boolean(term) && !available.some(tag => tag.name.toLowerCase() === term);

  async function save(action: "create" | "assign" | "remove", value: string) {
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ tags: ProfileTag[] }>("/api/staff/members", {
        action: "profile-tag." + action, personId, userId,
        ...(action === "create" ? { name: value } : { tagId: value }),
      });
      if (action === "create") setName("");
      await onSaved(result.tags);
      setMessage(action === "remove" ? "Tag removed." : "Tag added.");
      search.current?.focus();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.profileTags} aria-label="Profile tags">
      <h4>Assigned tags</h4>
      {assigned.length > 0 ? (
        <ul className={styles.tagList}>
          {assigned.map(tag => (
            <li key={tag.id}>
              {tag.name}
              {canManage && (
                <button className={styles.removeTag} type="button" disabled={busy} aria-label={`Remove tag ${tag.name}`}
                  onClick={() => void save("remove", tag.id)}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : <p>No tags assigned.</p>}
      {canManage && (
        <div className={styles.addTags}>
          <h4>Add tags</h4>
          <form className={styles.tagSearch} onSubmit={event => {
            event.preventDefault();
            if (!busy && canCreate) void save("create", newName);
          }}>
            <label>
              <span className="sr-only">Find or create a tag</span>
              <input ref={search} type="search" value={name} maxLength={60}
                placeholder="Find or create a tag" onChange={event => setName(event.target.value)} />
            </label>
            {canCreate && <button className="button secondary" type="submit" disabled={busy}>Create and add</button>}
          </form>
          {results.length > 0 ? (
            <ul className={styles.availableTags} aria-label="Available tags">
              {results.map(tag => (
                <li key={tag.id}>
                  <span>{tag.name}</span>
                  <button type="button" className="text-button" disabled={busy}
                    aria-label={`Add tag ${tag.name}`} onClick={() => void save("assign", tag.id)}>Add</button>
                </li>
              ))}
            </ul>
          ) : !canCreate && <p>{term ? "No matching tags to add." : available.length ? "All existing tags are assigned." : "Type a name to create the first tag."}</p>}
        </div>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
