"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useCanyon } from "@/lib/canyon/store";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  new URLSearchParams(window.location.search).has("rm");

/**
 * Scroll wiring and reveals for the landing page. Renders nothing.
 *
 * Chapter / blend follow the prototype's `readScroll()`: the chapter is the
 * last `main > section` whose top is above the viewport bottom, and blend is
 * how far that top has risen, (vh − top) / vh (1 for chapter 0). Progress
 * through each sticky chapter comes from one ScrollTrigger per chapter.
 * Everything goes straight to the zustand store; no React state per frame.
 */
export function LandingMotion({ root = "main[data-landing]" }: { root?: string }) {
  useGSAP(() => {
    const main = document.querySelector<HTMLElement>(root);
    if (!main) return;
    const sections = Array.from(main.querySelectorAll<HTMLElement>(":scope > section"));
    const { setChapter, setProgress } = useCanyon.getState();

    const readScroll = () => {
      const vh = window.innerHeight;
      let idx = 0;
      let blend = 1;
      for (let i = sections.length - 1; i >= 0; i--) {
        const top = sections[i].getBoundingClientRect().top;
        if (top < vh) {
          idx = i;
          blend = i === 0 ? 1 : clamp01((vh - top) / vh);
          break;
        }
      }
      setChapter(idx, blend);
    };

    sections.forEach((el, i) => {
      if (Number(el.dataset.h) > 100)
        ScrollTrigger.create({
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (st) => setProgress(i, st.progress),
          onRefresh: (st) => setProgress(i, st.progress),
        });
    });
    ScrollTrigger.create({ start: 0, end: "max", onUpdate: readScroll, onRefresh: readScroll });
    readScroll();

    const onLayout = () => ScrollTrigger.refresh();
    window.addEventListener("apex:layout", onLayout);

    // Hand the initial hidden states from the pre-paint CSS to GSAP. Both happen
    // in this task, before the next paint; GSAP must not parse the CSS
    // transform as a starting offset, so the attribute goes first.
    document.documentElement.removeAttribute("data-motion");
    (window as Window & { __apexMotion?: boolean }).__apexMotion = true;

    if (!reducedMotion()) {
      const hero = sections[0];
      // Title lines: 105% → 0 mask slide, expo.out 1.1 s, 80–90 ms stagger.
      main.querySelectorAll<HTMLElement>("[data-ln]").forEach((ln) => {
        const first = hero?.contains(ln) ?? false;
        const title = ln.parentElement as HTMLElement;
        const index = Array.from(title.querySelectorAll(":scope > [data-ln]")).indexOf(ln);
        gsap.fromTo(
          ln.firstElementChild,
          { yPercent: 105 },
          {
            yPercent: 0,
            duration: 1.1,
            ease: "expo.out",
            delay: first ? 0.35 + index * 0.09 : index * 0.08,
            scrollTrigger: first ? undefined : { trigger: title, start: "top 88%" },
          },
        );
      });
      // Ledes and controls: fade up 18px, power3.out 0.9 s, 120 ms delay.
      main.querySelectorAll<HTMLElement>("[data-rv]").forEach((el) => {
        const first = hero?.contains(el) ?? false;
        gsap.fromTo(
          el,
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            delay: first ? 0.8 : 0.12,
            scrollTrigger: first ? undefined : { trigger: el, start: "top 92%" },
          },
        );
      });
    }
    return () => window.removeEventListener("apex:layout", onLayout);
  });

  return null;
}
