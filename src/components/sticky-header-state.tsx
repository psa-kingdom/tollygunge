"use client";
import { useEffect, useRef } from "react";
export function StickyHeaderState() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const header = marker.current?.closest("header");
    if (!header) return;
    const measure = () =>
      document.documentElement.style.setProperty(
        "--member-header-offset",
        `${header.getBoundingClientRect().height}px`,
      );
    const scroll = () =>
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    measure();
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scroll);
    };
  }, []);
  return <span ref={marker} hidden />;
}
