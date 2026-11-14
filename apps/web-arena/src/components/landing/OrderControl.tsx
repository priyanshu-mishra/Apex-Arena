"use client";

import { useEffect, useRef, useState } from "react";
import { COPY } from "@/content/landing";
import { ORDER_MAX_ETH, walkAsks } from "@/lib/canyon/ladder";
import { REAL } from "@/lib/canyon/real";
import { useCanyon } from "@/lib/canyon/store";
import { cn } from "@/lib/utils";
import s from "./landing.module.css";
import { Readout } from "./Readout";

const c = COPY.c1;
const MIN = 1;
const MAX = ORDER_MAX_ETH;
const START = 12;

const fmt = (n: number, d = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * 01 Impact instruments: a 1–45 ETH buy order walked up the real ask ladder
 * (seed 42, tick 300), with impact, levels cleared and average fill.
 * "Send it", or letting go of the slider, fires the order slug into the scene.
 */
export function OrderControl() {
  const [qty, setQty] = useState(START);
  const inputRef = useRef<HTMLInputElement>(null);
  const walk = walkAsks(qty, REAL.asks, REAL.mid);
  const send = () => useCanyon.getState().sendOrder(Number(inputRef.current?.value ?? qty));

  // The prototype also sends on `change` (slider released); React's onChange is `input`.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onRelease = () => useCanyon.getState().sendOrder(Number(el.value));
    el.addEventListener("change", onRelease);
    return () => el.removeEventListener("change", onRelease);
  }, []);

  return (
    <div className={s.inst}>
      <div className={s.order}>
        <label htmlFor="order-size" className={s.orderLabel}>
          <span>{c.control.label}</span>
          {/* A span, not <output>: its implicit status role would compete with the status line. */}
          <span className={s.orderOut} aria-hidden="true">
            {qty}
            <small>{c.control.unit}</small>
          </span>
        </label>
        <input
          ref={inputRef}
          id="order-size"
          className={s.range}
          type="range"
          min={MIN}
          max={MAX}
          step={1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          aria-valuetext={`${qty} ${c.control.unit}`}
          aria-describedby="order-note"
        />
        <div className={s.orderRow}>
          <button className={cn(s.btn, s.pri)} type="button" onClick={send}>
            {c.control.send}
          </button>
          <span className={s.fine} id="order-note">
            {c.control.note}
          </span>
        </div>
      </div>
      <Readout
        className={s.c1r1}
        k={c.readouts.replay.k}
        v={
          <>
            0<small>bps</small>
          </>
        }
        sub={c.readouts.replay.s}
      />
      <Readout
        className={s.c1r2}
        tone="up"
        k={c.readouts.arena.k}
        v={
          <span data-testid="impact-bps">
            +{fmt(walk.impactBps, 1)}
            <small>bps</small>
          </span>
        }
        sub={`${walk.levelsCleared} ${c.readouts.arena.s}`}
      />
      <Readout
        className={s.c1r3}
        k={c.readouts.fill.k}
        v={<span data-testid="impact-avg">{fmt(walk.avgFill)}</span>}
        sub={`${c.readouts.fill.s} ${fmt(REAL.mid)}`}
      />
    </div>
  );
}
