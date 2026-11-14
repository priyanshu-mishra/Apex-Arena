"use client";

import { useEffect, useRef } from "react";
import { COPY } from "@/content/landing";
import { BASE_MID } from "@/lib/canyon/status";
import { useCanyon } from "@/lib/canyon/store";
import s from "./landing.module.css";
import { Readout } from "./Readout";

const c = COPY.c2;
/** Arbitrage opens once the gap clears the 30 bps pool fee. */
const FEE_BPS = 30;
/** The prototype's opening pool price sits 24 bps under the book. */
const OPENING_GAP_BPS = -24;
/** Shown before the scene mounts and without WebGL: the scene's base price and that opening pool. */
const INITIAL = { clob: BASE_MID, pool: BASE_MID * (1 + OPENING_GAP_BPS / 1e4) };

const fmt = (n: number, d = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const gapText = (bps: number) => `${bps > 0 ? "+" : "−"}${fmt(Math.abs(bps), 0)}`;
const INITIAL_GAP = ((INITIAL.pool - INITIAL.clob) / INITIAL.clob) * 1e4;

/**
 * 02 Two venues: order-book price, pool price and the gap between them,
 * read from `scene.status` at 10 Hz and written straight into the DOM.
 */
export function VenueReadouts() {
  const scene = useCanyon((st) => st.scene);
  const clobRef = useRef<HTMLSpanElement>(null);
  const poolRef = useRef<HTMLSpanElement>(null);
  const gapRef = useRef<HTMLSpanElement>(null);
  const gapNumRef = useRef<HTMLSpanElement>(null);
  const gapSubRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!scene) return;
    const last = { clob: "", pool: "", gap: "", open: false };
    const write = (el: HTMLElement | null, key: "clob" | "pool" | "gap", text: string) => {
      if (el && last[key] !== text) {
        el.textContent = text;
        last[key] = text;
      }
    };
    const update = () => {
      const st = scene.status;
      write(clobRef.current, "clob", fmt(st.mid));
      write(poolRef.current, "pool", fmt(st.pool));
      write(gapNumRef.current, "gap", gapText(st.gapBps));
      const open = Math.abs(st.gapBps) > FEE_BPS;
      if (open !== last.open) {
        last.open = open;
        gapRef.current?.classList.toggle(s.am, open);
        if (gapSubRef.current) gapSubRef.current.textContent = open ? c.readouts.gap.sOpen : c.readouts.gap.s;
      }
    };
    update();
    const id = window.setInterval(update, 100);
    return () => window.clearInterval(id);
  }, [scene]);

  return (
    <div className={s.inst}>
      <Readout className={s.c2r1} k={c.readouts.clob.k} v={fmt(INITIAL.clob)} sub={c.readouts.clob.s} valueRef={clobRef} />
      <Readout
        className={s.c2r2}
        tone="pl"
        k={c.readouts.pool.k}
        v={fmt(INITIAL.pool)}
        sub={c.readouts.pool.s}
        valueRef={poolRef}
      />
      <Readout
        className={s.c2r3}
        k={c.readouts.gap.k}
        v={
          <>
            <span ref={gapNumRef}>{gapText(INITIAL_GAP)}</span>
            <small>bps</small>
          </>
        }
        sub={c.readouts.gap.s}
        valueRef={gapRef}
        subRef={gapSubRef}
      />
      <p className={`${s.fine} ${s.c2Fine}`}>{c.caption}</p>
    </div>
  );
}
