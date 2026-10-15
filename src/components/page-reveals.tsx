"use client";

import { useEffect, useRef } from "react";

/** Progressive enhancement: content starts visible and is never gated by JS. */
export function PageReveals({ sectionsSelector = ":scope > .section" }: { sectionsSelector?: string }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const main = marker.current?.closest("main");
    if (!main || !("IntersectionObserver" in window)) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const sections = [...main.querySelectorAll<HTMLElement>(sectionsSelector)];
    let observer: IntersectionObserver | undefined;
    const reset = () => {
      observer?.disconnect();
      sections.forEach((section) => section.classList.remove("reveal-waiting"));
      if (preference.matches) return;
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove("reveal-waiting");
            observer?.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05 });
      const belowFold = sections.filter((section) => section.getBoundingClientRect().top > innerHeight);
      belowFold.forEach((section) => { section.classList.add("reveal-waiting"); observer?.observe(section); });
    };
    reset();
    preference.addEventListener("change", reset);
    return () => { observer?.disconnect(); preference.removeEventListener("change", reset); sections.forEach((section) => section.classList.remove("reveal-waiting")); };
  }, [sectionsSelector]);
  return <span hidden ref={marker} />;
}
