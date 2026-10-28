"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";
import Lenis from "lenis";

/** One homepage motion owner; the unenhanced page is complete and visible. */
export function HomepageMotion({ disabled = false }: { disabled?: boolean }) {
  const marker = useRef<HTMLSpanElement>(null);
  const introEligible = useRef<boolean | null>(null);
  useEffect(() => {
    const main = marker.current?.closest("main");
    if (!main || disabled) return;
    gsap.registerPlugin(ScrollTrigger, CustomEase);
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const running = new Set<gsap.core.Timeline>();
    const triggers: ScrollTrigger[] = [];
    const originals = new Map<
      HTMLElement,
      { html: string; label: string | null }
    >();
    const context = gsap.context(() => {}, main);
    let keyboard = false,
      disposed = false,
      refreshFrame = 0;
    let lenis: Lenis | undefined;
    const styles = getComputedStyle(main);
    const token = styles.getPropertyValue("--motion-enter").trim();
    const duration =
      parseFloat(token) * (token.endsWith("ms") ? 0.001 : 1) || 0.45;
    const curve =
      styles.getPropertyValue("--ease-out").trim() ||
      "cubic-bezier(0.23, 1, 0.32, 1)";
    const ease = CustomEase.create(
      "tpa-home-ease",
      curve.replace(/^cubic-bezier\(|\)$/g, ""),
    );
    const split = (heading: HTMLElement) => {
      originals.set(heading, {
        html: heading.innerHTML,
        label: heading.getAttribute("aria-label"),
      });
      heading.setAttribute(
        "aria-label",
        heading.innerText.replace(/\s+/g, " ").trim(),
      );
      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT),
        nodes: Text[] = [];
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (!node.parentElement?.closest("a, button")) nodes.push(node);
      }
      nodes.forEach((node) => {
        const fragment = document.createDocumentFragment();
        node.textContent?.split(/(\s+)/).forEach((word) => {
          if (!word.trim()) fragment.append(document.createTextNode(word));
          else {
            const span = document.createElement("span");
            span.dataset.homeWord = "";
            span.setAttribute("aria-hidden", "true");
            span.textContent = word;
            fragment.append(span);
          }
        });
        node.replaceWith(fragment);
      });
    };
    main
      .querySelectorAll<HTMLElement>(
        ".hero h1, .intro h2, .section-heading h2, .v3-membership-heading h2, .v3-contact-copy h2",
      )
      .forEach(split);
    const tick = (time: number) => lenis?.raf(time * 1000);
    const nativeScroll = () => {
      lenis?.destroy();
      lenis = undefined;
      gsap.ticker.remove(tick);
      delete main.dataset.smoothScroll;
    };
    const smoothScroll = () => {
      if (
        lenis ||
        disposed ||
        keyboard ||
        preference.matches ||
        !finePointer.matches ||
        document.hidden
      )
        return;
      lenis = new Lenis({
        lerp: 0.14,
        smoothWheel: true,
        syncTouch: false,
        autoRaf: false,
        prevent: (node) =>
          !!node.closest(
            ".site-header, .site-footer, form, [data-lenis-prevent]",
          ),
      });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);
      main.dataset.smoothScroll = "lenis";
    };
    const stop = () => {
      running.forEach((animation) => {
        animation.progress(1);
        animation.kill();
      });
      running.clear();
      main.dataset.motionState = "idle";
    };
    const reveal = (element: HTMLElement, hero = false) => {
      element.dataset.motionRevealed = "true";
      if (keyboard || preference.matches || document.hidden) return;
      context.add(() => {
        const words = element.querySelectorAll<HTMLElement>("[data-home-word]");
        const copy = hero
          ? element.querySelectorAll<HTMLElement>(
              ".hero-copy > .eyebrow, .hero-copy > p, .button-row, .hero-note",
            )
          : [...element.children].filter(
              (child) => !child.matches("h1, h2") && !child.querySelector("h2"),
            );
        const animation = gsap.timeline({
          onComplete: () => {
            running.delete(animation);
            if (!running.size) main.dataset.motionState = "idle";
          },
        });
        running.add(animation);
        main.dataset.motionState = "running";
        if (words.length)
          animation.fromTo(
            words,
            { opacity: 0.65, y: 12 },
            {
              opacity: 1,
              y: 0,
              duration,
              stagger: 0.045,
              ease,
              clearProps: "transform,opacity",
            },
            0,
          );
        if (copy.length)
          animation.fromTo(
            copy,
            { opacity: 0.65, y: 10 },
            {
              opacity: 1,
              y: 0,
              duration,
              stagger: 0.06,
              ease,
              clearProps: "transform,opacity",
            },
            0.1,
          );
      });
    };
    if (introEligible.current === null) {
      let seen = false;
      try {
        seen = sessionStorage.getItem("tpa-home-intro-seen") === "true";
        sessionStorage.setItem("tpa-home-intro-seen", "true");
      } catch {
        /* Storage is optional. */
      }
      introEligible.current = !seen && !location.hash && scrollY < 20;
    }
    const hero = main.querySelector<HTMLElement>(".hero");
    if (hero && introEligible.current) reveal(hero, true);
    main
      .querySelectorAll<HTMLElement>(
        ".v3-about .intro, .editorial-grid, .v3-events .section-heading, .newsletter-copy, .v3-membership-heading, .v3-membership-grid, .v3-contact-copy",
      )
      .forEach((element) => {
        if (element.getBoundingClientRect().top < innerHeight) return;
        triggers.push(
          ScrollTrigger.create({
            trigger: element,
            start: "top bottom+=48",
            once: true,
            onEnter: () => reveal(element),
          }),
        );
      });
    const refresh = () => {
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => {
        if (!disposed) {
          lenis?.resize();
          ScrollTrigger.refresh();
        }
      });
    };
    const key = () => {
      keyboard = true;
      main.dataset.motionInput = "keyboard";
      nativeScroll();
      stop();
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      keyboard = false;
      main.dataset.motionInput = "pointer";
      if (!(event.target as Element).closest("form")) smoothScroll();
    };
    const wheel = () => {
      keyboard = false;
      main.dataset.motionInput = "pointer";
      smoothScroll();
    };
    const focus = () => {
      stop();
      nativeScroll();
    };
    const preferenceChange = () => {
      stop();
      if (preference.matches) nativeScroll();
      else smoothScroll();
    };
    const visibility = () => {
      if (document.hidden) {
        stop();
        nativeScroll();
      } else smoothScroll();
    };
    const blur = () => {
      stop();
      nativeScroll();
    };
    smoothScroll();
    main.dataset.motionReady = "true";
    void document.fonts.ready.then(refresh);
    main.addEventListener("load", refresh, true);
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("wheel", wheel, { passive: true });
    main.addEventListener("focusin", focus);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    finePointer.addEventListener("change", preferenceChange);
    preference.addEventListener("change", preferenceChange);
    return () => {
      disposed = true;
      cancelAnimationFrame(refreshFrame);
      nativeScroll();
      stop();
      triggers.forEach((trigger) => trigger.kill());
      context.revert();
      originals.forEach((original, heading) => {
        heading.innerHTML = original.html;
        if (original.label === null) heading.removeAttribute("aria-label");
        else heading.setAttribute("aria-label", original.label);
      });
      main.removeEventListener("load", refresh, true);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("wheel", wheel);
      main.removeEventListener("focusin", focus);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      finePointer.removeEventListener("change", preferenceChange);
      preference.removeEventListener("change", preferenceChange);
      delete main.dataset.motionReady;
      delete main.dataset.motionInput;
      delete main.dataset.motionState;
    };
  }, [disabled]);
  return <span ref={marker} hidden />;
}
