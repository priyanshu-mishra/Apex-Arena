"use client";

import { type RefObject, useEffect } from "react";

/**
 * Fade length below the bar: copy is fully back this far under it. Short
 * enough that a stuck stage's first line (84px desktop, 76px phone) is never
 * touched by the fade.
 */
export const BAR_FADE_PX = 12;

/**
 * Keeps chapter copy out of the fixed top bar. Every child of a
 * `[data-bar-clip]` block (sticky stages, flowing chapters) gets a mask while
 * it reaches the bar: fully transparent over the whole bar band (down to the
 * bar's bottom edge), back to full strength `BAR_FADE_PX` lower. The mask sits on
 * the copy blocks, not their scrims, and nothing is masked while a block is
 * below the bar, so the first viewport is untouched.
 *
 * The mask lines are written as `--bar-a` / `--bar-b` (block coordinates) and
 * `data-bar-clipping` turns the mask on (landing.module.css).
 */
export function useBarClip(header: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const bar = header.current;
    if (!bar) return;
    let clear = 0;
    let raf = 0;
    let blocks: HTMLElement[] = [];
    const last = new Map<HTMLElement, string>();

    const measure = () => {
      // The clear line is the bar's bottom edge (its padding follows the viewport).
      clear = bar.getBoundingClientRect().bottom;
    };
    const collect = () => {
      if (blocks.length && blocks.every((el) => el.isConnected)) return;
      blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-bar-clip] > *"));
    };
    const update = () => {
      raf = 0;
      collect();
      // Read every box first, then write.
      const boxes = blocks.map((el) => el.getBoundingClientRect());
      blocks.forEach((el, i) => {
        // A block wholly above the screen keeps its mask until it comes back.
        if (boxes[i].bottom < 0 && last.get(el)) return;
        const a = clear - boxes[i].top;
        // Active from the moment the fade would first touch the block (no pop).
        const v = a > -BAR_FADE_PX ? `${a.toFixed(1)}` : "";
        if (last.get(el) === v) return;
        last.set(el, v);
        if (v) {
          el.style.setProperty("--bar-a", `${v}px`);
          el.style.setProperty("--bar-b", `${(a + BAR_FADE_PX).toFixed(1)}px`);
          el.setAttribute("data-bar-clipping", "");
        } else {
          el.style.removeProperty("--bar-a");
          el.style.removeProperty("--bar-b");
          el.removeAttribute("data-bar-clipping");
        }
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      schedule();
    };

    measure();
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    // Web fonts and the Plain / Precise switch change block heights and the bar.
    const ro = new ResizeObserver(onResize);
    ro.observe(bar);
    ro.observe(document.body);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, [header]);
}
