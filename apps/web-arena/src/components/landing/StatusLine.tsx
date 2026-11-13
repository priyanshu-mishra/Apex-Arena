"use client";

import { useEffect, useRef } from "react";
import { STATUS } from "@/content/landing";
import { useCanyon } from "@/lib/canyon/store";
import s from "./landing.module.css";

const fmt = (n: number, d = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const tick = (n: number) => String(Math.max(0, Math.floor(n)) % 1_000_000).padStart(6, "0");

/** Initial values match the scene's starting status (and the no-WebGL fallback). */
const INITIAL = { tick: 0, mid: 2241.5, spreadBps: 4, lambda: 0.2, regime: "calm" };

/**
 * The persistent status line. Fed by `scene.status` at 4 Hz through direct
 * DOM writes; `aria-live="off"` so it never chatters.
 */
export function StatusLine() {
  const scene = useCanyon((st) => st.scene);
  const tickRef = useRef<HTMLElement>(null);
  const pxRef = useRef<HTMLElement>(null);
  const spRef = useRef<HTMLElement>(null);
  const lamRef = useRef<HTMLElement>(null);
  const regRef = useRef<HTMLDivElement>(null);
  const regTextRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!scene) return;
    const last = { tick: "", px: "", sp: "", lam: "", reg: "" };
    const write = (el: HTMLElement | null, key: keyof typeof last, text: string) => {
      if (el && last[key] !== text) {
        el.textContent = text;
        last[key] = text;
      }
    };
    const update = () => {
      const st = scene.status;
      write(tickRef.current, "tick", tick(st.tick));
      write(pxRef.current, "px", fmt(st.mid));
      write(spRef.current, "sp", fmt(st.spreadBps, 1));
      write(lamRef.current, "lam", fmt(st.lambda));
      if (last.reg !== st.regime) {
        write(regTextRef.current, "reg", st.regime);
        if (st.regime === "calm") regRef.current?.removeAttribute("data-hot");
        else regRef.current?.setAttribute("data-hot", "");
      }
    };
    update();
    const id = window.setInterval(update, 250);
    return () => window.clearInterval(id);
  }, [scene]);

  return (
    <div className={s.hud} role="status" aria-live="off" aria-label="Market status">
      <div>
        {STATUS.seed} <b>42</b>
      </div>
      <div className={s.opt2}>
        {STATUS.tick} <b ref={tickRef} data-testid="landing-tick">{tick(INITIAL.tick)}</b>
      </div>
      <div>
        {STATUS.eth} <b ref={pxRef}>{fmt(INITIAL.mid)}</b>
      </div>
      <div className={s.opt}>
        {STATUS.spread} <b ref={spRef}>{fmt(INITIAL.spreadBps, 1)}</b> {STATUS.bps}
      </div>
      <div className={s.opt}>
        {STATUS.lambda} <b ref={lamRef}>{fmt(INITIAL.lambda)}</b>
      </div>
      <div ref={regRef} className={s.regime}>
        <b ref={regTextRef}>{INITIAL.regime}</b>
      </div>
      <div className={s.hudSpacer} />
      <div className={s.opt}>{STATUS.note}</div>
    </div>
  );
}
