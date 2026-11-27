"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ResourceImage } from "./resource-collections";

export function ResourceMediaGallery({ media, preview = false }: { media: ResourceImage[]; preview?: boolean }) {
  const [selected, setSelected] = useState<ResourceImage | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!selected) return;
    const surface = dialog.current;
    const opener = trigger.current;
    const previousOverflow = document.body.style.overflow;
    surface?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      surface?.close();
      document.body.style.overflow = previousOverflow;
      opener?.focus({ preventScroll: true });
    };
  }, [selected]);

  return (
    <>
      <div className="resource-card-grid">
        {media.map((photo) => (
          <figure className="resource-gallery-tile" key={photo.id}
            data-cms-record={preview ? `media:${photo.id}` : undefined}>
            <button type="button" className="resource-gallery-open"
              aria-label={`View ${photo.published.title}`} aria-haspopup="dialog"
              onClick={(event) => {
                trigger.current = event.currentTarget;
                setSelected(photo);
              }}>
              <Image unoptimized src={`/media/${photo.id}`} width={photo.width} height={photo.height}
                alt={photo.published.altText} />
            </button>
            <figcaption>{photo.published.title}{photo.published.category && <small>{photo.published.category}</small>}</figcaption>
          </figure>
        ))}
      </div>
      {selected && (
        <dialog ref={dialog} className="resource-gallery-dialog" aria-label={selected.published.title}
          onCancel={(event) => { event.preventDefault(); setSelected(null); }}
          onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div className="resource-gallery-view">
            <div className="resource-gallery-view-heading">
              <h2>{selected.published.title}</h2>
              <button type="button" className="button secondary" onClick={() => setSelected(null)}>Close photo</button>
            </div>
            <Image unoptimized src={`/media/${selected.id}`} width={selected.width} height={selected.height}
              alt={selected.published.altText} loading="eager" />
          </div>
        </dialog>
      )}
    </>
  );
}
