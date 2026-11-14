"use client";

import { type RefObject, useEffect } from "react";

/**
 * Fade length below the bar: copy is fully back this far under it. Short
 * enough that a stuck stage's first line (84px desktop, 76px phone) is never
 * touched by the fade.
 */
export const BAR_FADE_PX = 12;
/**
 * Descender allowance, as a share of a block's largest font size. Display
 * lines are set at line-height 0.94, so a "y" or "p" hangs below its line box:
 * once a line's body is under the bar, its descenders must go too.
 */
export const BAR_DESCENT_EM = 0.3;

/**
 * Keeps chapter copy out of the fixed top bar. Every child of a
 * `[data-bar-clip]` block (sticky stages, flowing chapters) gets a mask while
 * it reaches the bar: fully transparent over the whole bar band (down to the
 * bar's bottom edge), back to full strength `BAR_FADE_PX` lower. The mask sits on
 * the copy blocks, not their scrims, and nothing is masked while a block is
 * below the bar, so the first viewport is untouched.
 *
 * Once a block has started under the bar, the clear line also moves down with
 * it, by up to `BAR_DESCENT_EM` of the block's largest type, so no descender is
 * left hanging under the bar after its line has gone. The move starts at zero
 * when the block's top meets the bar, so nothing pops.
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
    /** Descender allowance per block, px (its largest font size × BAR_DESCENT_EM). */
    const descent = new Map<HTMLElement, number>();
    const descentOf = (el: HTMLElement) => {
      let d = descent.get(el);
      if (d === undefined) {
        let size = parseFloat(getComputedStyle(el).fontSize) || 0;
        for (const c of Array.from(el.querySelectorAll<HTMLElement>("*")))
          if (c.childElementCount === 0) size = Math.max(size, parseFloat(getComputedStyle(c).fontSize) || 0);
        d = size * BAR_DESCENT_EM;
        descent.set(el, d);
      }
      return d;
    };

    const measure = () => {
      // The clear line is the bar's bottom edge (its padding follows the viewport).
      clear = bar.getBoundingClientRect().bottom;
      // Type sizes follow the viewport (clamp() with vw): measure them again.
      descent.clear();
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
        const top = clear - boxes[i].top;
        // Active from the moment the fade would first touch the block (no pop);
        // past the bar's edge, the clear line follows the block down by its descender allowance.
        const a = top > -BAR_FADE_PX ? top + Math.min(descentOf(el), Math.max(0, top)) : 0;
        const v = top > -BAR_FADE_PX ? `${a.toFixed(1)}` : "";
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
