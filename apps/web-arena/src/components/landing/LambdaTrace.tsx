"use client";

import { useEffect, useRef } from "react";
import { CHAPTER_IDS, COPY } from "@/content/landing";
import { canyonState, useCanyon } from "@/lib/canyon/store";
import s from "./landing.module.css";
import { Readout } from "./Readout";

const c = COPY.c3;
const SAMPLES = 240;
const HZ = 12;
/** λ that fills the trace's height. */
const CEIL = 3.2;
const INITIAL = 0.2;
const CHAOS = CHAPTER_IDS.indexOf("c3");

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function draw(ctx: CanvasRenderingContext2D, buf: Float32Array) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(237,234,227,.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h - 8.5);
  ctx.lineTo(w, h - 8.5);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < SAMPLES; i++) {
    const x = (i / (SAMPLES - 1)) * w;
    const y = h - 8 - (Math.min(buf[i], CEIL) / CEIL) * (h - 16);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.strokeStyle = "#FFB020";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.lineTo(w, h - 8);
  ctx.lineTo(0, h - 8);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,176,32,.10)";
  ctx.fill();
}

/**
 * 03 Chaos: the shock-intensity readout and a 2D-canvas λ trace,
 * 240 samples at 12 Hz (the last 20 s) from `scene.status.lambda`.
 * Under reduced motion a sample is taken only when λ changes.
 */
export function LambdaTrace() {
  const scene = useCanyon((st) => st.scene);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let lastLam = scene ? scene.status.lambda : INITIAL;
    const buf = new Float32Array(SAMPLES).fill(lastLam);
    draw(ctx, buf);
    if (!scene) return;
    const rm = scene.reducedMotion;
    let shown = fmt(lastLam);
    if (valueRef.current) valueRef.current.textContent = shown;
    let dirty = false;
    const id = window.setInterval(() => {
      const lam = scene.status.lambda;
      if (!rm || lam !== lastLam) {
        lastLam = lam;
        buf.copyWithin(0, 1);
        buf[SAMPLES - 1] = lam;
        dirty = true;
        const text = fmt(lam);
        if (text !== shown && valueRef.current) valueRef.current.textContent = shown = text;
      }
      // Draw only while chapter 03 is on screen (it stays visible while 04 rises).
      const ch = canyonState().chapter;
      if (dirty && (ch === CHAOS || ch === CHAOS + 1)) {
        draw(ctx, buf);
        dirty = false;
      }
    }, 1000 / HZ);
    return () => window.clearInterval(id);
  }, [scene]);

  return (
    <>
      <Readout className={s.c3r1} tone="am" k={c.readout.k} v={fmt(INITIAL)} sub={c.readout.s} valueRef={valueRef} />
      <div className={s.trace}>
        <canvas ref={canvasRef} width={600} height={148} role="img" aria-label={c.traceLabel} />
      </div>
    </>
  );
}
