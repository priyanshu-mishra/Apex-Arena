"use client";

import { useEffect, useRef } from "react";
import { CHAPTER_IDS, COPY } from "@/content/landing";
import { type CanyonStore, useCanyon } from "@/lib/canyon/store";
import s from "./landing.module.css";

const c = COPY.c4;
const TICKS = 100;
const BARRIER = CHAPTER_IDS.indexOf("c4");
/** Guide §4: 0–42% fills the ticks, 42–86% the market is held, then it runs again. */
const FILL_END = 0.42;
const HOLD_END = 0.86;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pad = (n: number) => String(n).padStart(3, "0");

/**
 * 04 The barrier: 100 hairline ticks (every tenth taller) filled by scroll,
 * the fast-clock line, and the amber "market held" note while the clock is
 * stopped. Driven by a store subscription with direct DOM writes.
 */
export function TickStrip() {
  const rootRef = useRef<HTMLDivElement>(null);
  const ticksRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLElement>(null);
  const holdRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const ticks = ticksRef.current ? Array.from(ticksRef.current.children) : [];
    let lit = 0;
    let held = false;
    const apply = (st: CanyonStore) => {
      const in4 = st.chapter === BARRIER && st.blend > 0.98;
      const p = st.progress[BARRIER] ?? 0;
      const on = in4 ? Math.round(clamp01(p / FILL_END) * TICKS) : 0;
      const hold = in4 && p >= FILL_END && p < HOLD_END;
      if (on !== lit) {
        const [a, b] = on > lit ? [lit, on] : [on, lit];
        for (let i = a; i < b; i++) ticks[i]?.classList.toggle(s.on, i < on);
        lit = on;
        if (countRef.current) countRef.current.textContent = pad(on);
      }
      if (hold !== held) {
        held = hold;
        root?.toggleAttribute("data-held", hold);
        holdRef.current?.setAttribute("aria-hidden", String(!hold));
      }
    };
    apply(useCanyon.getState());
    return useCanyon.subscribe(apply);
  }, []);

  return (
    <div ref={rootRef} className={s.tickStrip} data-shield="">
      <div ref={ticksRef} className={s.ticks} aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <div className={s.clock}>
        <span>
          {c.clock.fast}{" "}
          <b ref={countRef} data-testid="fast-clock">
            {pad(0)}
          </b>{" "}
          {c.clock.of}
        </span>
        <span ref={holdRef} className={s.hold} aria-hidden="true">{c.clock.held}</span>
        <span>{c.clock.each}</span>
      </div>
    </div>
  );
}
