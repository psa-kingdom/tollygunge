"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { api } from "./operations-client";
type Details = {
  title: string;
  altText: string;
  category: string;
  homepageFeatured?: boolean;
};
type Asset = {
  id: string;
  draft: Details;
  published: Details | null;
  width: number;
  height: number;
  version: number;
};
type Library = { assets: Asset[]; uploadEnabled: boolean };
const empty: Details = {
  title: "",
  altText: "",
  category: "",
  homepageFeatured: false,
};
export function MediaWorkspace() {
  const [library, setLibrary] = useState<Library>(),
    [selected, setSelected] = useState<Asset>(),
    [form, setForm] = useState<Details>(empty),
    [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("Loading media…");
  useEffect(() => {
    api<Library>("/api/staff/media" + (location.search || ""))
      .then((data) => {
        setLibrary(data);
        const id = new URLSearchParams(location.search).get("id");
        const asset = data.assets.find((a) => a.id === id);
        if (asset) {
          setSelected(asset);
          setForm(asset.draft);
        }
        setMessage("");
      })
      .catch((e) => setMessage(e.message));
  }, []);
  async function refresh(id?: string) {
    const data = await api<Library>("/api/staff/media");
    setLibrary(data);
    if (id) {
      const asset = data.assets.find((a) => a.id === id);
      setSelected(asset);
      if (asset) setForm(asset.draft);
    }
  }
  async function action(kind: string) {
    if (!selected) return;
    setBusy(true);
    try {
      await api("/api/staff/media", {
        action: kind,
        id: selected.id,
        version: selected.version,
      });
      await refresh(selected.id);
      setMessage(
        kind === "publish"
          ? "Saved image and description are now public."
          : "Image unpublished. Public access is closed.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p>
        Upload editorial images, review their descriptions, then explicitly
        publish them to Resources → Media. Upload only images you have
        permission to publish. Application documents are excluded.
      </p>
      <p>
        Published assets appear in Resources. Choose homepage placement below to
        include an image in the landing page gallery (latest three). Save
        changes, then publish to update public descriptions and placement. Image
        files are retained as separate assets; upload a new image and withdraw
        the old one to replace a photograph.
      </p>
      {library && !library.uploadEnabled && (
        <p className="notice">
          Uploads await managed production storage configuration.
        </p>
      )}
      <div className="operations-layout">
        <aside className="record-list">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setSelected(undefined);
              setForm(empty);
              setFile(undefined);
              setMessage("");
            }}
          >
            New image
          </button>
          {library?.assets.map((asset) => (
            <button
              key={asset.id}
              disabled={busy}
              onClick={() => {
                setSelected(asset);
                setForm(asset.draft);
                setMessage("");
              }}
            >
              <strong>{asset.draft.title}</strong>
              <small>
                {asset.published ? "Published" : "Private draft"} ·{" "}
                {asset.draft.category}
              </small>
            </button>
          ))}
          {library && !library.assets.length && <p>No editorial images yet.</p>}
          {library?.assets.length === 100 && (
            <p>Showing the latest 100 assets.</p>
          )}
        </aside>
        <section>
          <h2>{selected ? "Image details" : "New editorial image"}</h2>
          <form
            className="member-settings"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                if (selected) {
                  await api("/api/staff/media", {
                    action: "save",
                    id: selected.id,
                    version: selected.version,
                    details: form,
                  });
                  await refresh(selected.id);
                  setMessage(
                    "Draft details saved. Publish to update the public description.",
                  );
                } else {
                  if (!file) throw new Error("Choose an image.");
                  const body = new FormData();
                  body.set("file", file);
                  for (const [key, value] of Object.entries(form))
                    body.set(key, String(value));
                  const response = await fetch("/api/staff/media", {
                    method: "POST",
                    body,
                  });
                  const result = await response.json();
                  if (!response.ok)
                    throw new Error(result.error ?? "Upload failed.");
                  await refresh(result.id);
                  setFile(undefined);
                  setMessage(
                    "Image saved privately. Review before publishing.",
                  );
                }
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Save failed.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {!selected && (
              <label>
                Image (JPEG/PNG, up to 5 MB)
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  required
                  onChange={(e) => setFile(e.target.files?.[0])}
                />
              </label>
            )}
            <label>
              Title
              <input
                required
                minLength={3}
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Category
              <input
                required
                minLength={3}
                maxLength={60}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </label>
            <label>
              Accessible image description
              <textarea
                required
                minLength={5}
                maxLength={240}
                value={form.altText}
                onChange={(e) => setForm({ ...form, altText: e.target.value })}
              />
            </label>
            <button
              className="button"
              disabled={busy || (!selected && !library?.uploadEnabled)}
            >
              {selected ? "Save draft details" : "Upload private draft"}
            </button>
            <label className="consent">
              <input
                type="checkbox"
                checked={form.homepageFeatured === true}
                onChange={(e) =>
                  setForm({ ...form, homepageFeatured: e.target.checked })
                }
              />
              Feature in the homepage gallery after publication
            </label>
          </form>
          {selected && (
            <>
              <Image
                unoptimized
                src={`/media/${selected.id}`}
                width={selected.width}
                height={selected.height}
                alt={selected.draft.altText}
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: 460,
                  objectFit: "contain",
                }}
              />
              <p>
                {selected.published
                  ? "Public image; draft edits require publication."
                  : "Private editorial preview."}
              </p>
              <div className="action-row">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => action("publish")}
                >
                  Publish saved image and description
                </button>
                <button
                  className="button secondary"
                  disabled={busy || !selected.published}
                  onClick={() => action("unpublish")}
                >
                  Unpublish image
                </button>
              </div>
            </>
          )}
          <p role="status">{message}</p>
        </section>
      </div>
    </>
  );
}
