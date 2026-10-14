"use client";

import Image from "next/image";
import { useRef, useState } from "react";

const chapters = [
  { title: "A city of ideas.", text: "Kolkata is our shared setting. Tollygunge is where our community comes together, with room for new perspectives and lasting connections.", image: "kolkata-map.svg", alt: "Geographic outline of Kolkata, with north at the top", heading: "Kolkata", caption: "Our community’s home in South Kolkata." },
  { title: "Good people.", text: "Different experiences. Shared curiosity. A community grows through the conversations, friendships and contributions of its people.", image: "book-community-watercolor.webp", alt: "Watercolor illustration of fictional professionals standing together", heading: "Community", caption: "An illustration of professional fellowship." },
  { title: "Shared knowledge.", text: "Every conversation can open a new perspective. Books, ideas and practical experience give us a place to begin learning together.", image: "book-knowledge-watercolor.webp", alt: "Watercolor books, notes, reading glasses and a fountain pen", heading: "Knowledge", caption: "A new chapter starts with curiosity." },
];

export function CommunityAtlas() {
  const [open, setOpen] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [focused, setFocused] = useState(false);
  const cover = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const previous = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const page = chapters[chapter];
  function closeBook() { setOpen(false); setFocused(false); requestAnimationFrame(() => cover.current?.focus()); }
  return (
    <div className="tpa-atlas" onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); closeBook(); } }}>
      <div className="tpa-atlas-book" data-open={open}>
        <button ref={cover} className="tpa-book-cover" hidden={open} aria-expanded={open} aria-controls="tpa-atlas-spread" onClick={() => { setOpen(true); requestAnimationFrame(() => close.current?.focus()); }}>
          <span className="tpa-cover-imprint">Tollygunge Professional Association</span>
          <span className="tpa-cover-title">Welcome<br />to TPA</span>
          <span className="tpa-cover-seal" aria-hidden="true">TPA</span>
          <span>A community of knowledge.</span>
          <span className="tpa-cover-invitation">Open the atlas <span aria-hidden="true">↗</span></span>
        </button>
        <div id="tpa-atlas-spread" className="tpa-book-spread" hidden={!open}>
          <div className="tpa-book-text">
            <span className="tpa-book-imprint">The TPA atlas</span>
            <div key={chapter} className="tpa-book-chapter" aria-live="polite" aria-atomic="true"><h3>{page.title}</h3><p>{page.text}</p></div>
            <span className="tpa-book-page-number">Chapter {chapter + 1} of {chapters.length}</span>
          </div>
          <div className="tpa-book-image">
            <h3>{page.heading}</h3>
            <div className="tpa-book-art" data-focused={chapter === 0 && focused}>
              <Image key={page.image} src={`/design/${page.image}`} alt={page.alt} width={440} height={460} sizes="(max-width: 600px) 42vw, 320px" />
              {chapter === 0 && <button className="tpa-map-marker" aria-pressed={focused} aria-label="Highlight Tollygunge, South Kolkata" onClick={() => setFocused(!focused)}><span aria-hidden="true" /><span>Tollygunge</span></button>}
            </div>
            <p>{page.caption}</p>
          </div>
        </div>
      </div>
      <div className="tpa-atlas-controls">
        <p>{open ? "A little local knowledge, one page at a time." : "Rooted in Kolkata. Open to knowledge."}</p>
        <div hidden={!open} className="tpa-book-navigation">
          <button ref={close} onClick={closeBook}>Close book</button>
          <button ref={previous} aria-label="Previous book chapter" disabled={chapter === 0} onClick={() => { setChapter(chapter - 1); if (chapter === 1) requestAnimationFrame(() => next.current?.focus()); }}>←</button>
          <button ref={next} aria-label="Next book chapter" disabled={chapter === chapters.length - 1} onClick={() => { setChapter(chapter + 1); if (chapter === chapters.length - 2) requestAnimationFrame(() => previous.current?.focus()); }}>→</button>
        </div>
      </div>
      {open && chapter === 0 && <p className="tpa-atlas-credit">Locality outline, not an office address. <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a></p>}
      <noscript><p>The atlas needs JavaScript. <a href="https://www.openstreetmap.org/node/1350661689">View Tollygunge on OpenStreetMap</a>.</p></noscript>
    </div>
  );
}
