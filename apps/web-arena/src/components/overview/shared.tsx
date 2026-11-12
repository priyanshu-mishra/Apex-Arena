"use client";

import React from "react";
import type { ArenaTelemetryFrame } from "../../lib/sharedBuffer";

export const SCALE = 1e8;
export const POOL_FEE = 0.003; // 30 bps on the Revm pool
export const TICKS_PER_EPOCH = 100;
export const FAST_TICK_MS = 10;

export function lambdaOf(frame: ArenaTelemetryFrame): number {
  return frame.hawkesIntensityPips / SCALE;
}

export function fmtAcs(bps: number): string {
  return (bps / 10000).toFixed(3);
}

export function fmtPct(n: number, digits = 2): string {
  return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(digits) + "%";
}

export function fmtBps(n: number, digits = 1): string {
  return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(digits) + " bps";
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Multi-series inline-SVG sparkline. All series share one y-domain so two
 * prices on the same axis (CLOB vs Revm) are directly comparable.
 */
export function Sparkline({
  series,
  height = 120,
  width = 480,
  ariaLabel,
  baseline,
  fillFirst,
}: {
  series: { values: number[]; color: string; strokeWidth?: number; dash?: string }[];
  height?: number;
  width?: number;
  ariaLabel: string;
  /** Optional horizontal reference line value. */
  baseline?: { value: number; color: string; label?: string };
  fillFirst?: boolean;
}) {
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  if (baseline) all.push(baseline.value);
  if (all.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={ariaLabel}>
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="var(--border-strong)" strokeDasharray="3 4" />
      </svg>
    );
  }
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (max - min < 1e-9) {
    max += 1;
    min -= 1;
  }
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;
  const y = (v: number) => height - ((v - min) / (max - min)) * height;

  const paths = series.map((s) => {
    const n = s.values.length;
    const step = n > 1 ? width / (n - 1) : width;
    const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
    return { d, s, n, step };
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      style={{ display: "block", overflow: "visible" }}
    >
      {baseline ? (
        <line
          x1={0}
          x2={width}
          y1={y(baseline.value)}
          y2={y(baseline.value)}
          stroke={baseline.color}
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {fillFirst && paths[0] && paths[0].n > 1 ? (
        <path
          d={`${paths[0].d} L${width},${height} L0,${height} Z`}
          fill={paths[0].s.color}
          opacity={0.1}
          stroke="none"
        />
      ) : null}
      {paths.map(({ d, s }, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={s.color}
          strokeWidth={s.strokeWidth ?? 1.75}
          strokeDasharray={s.dash}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

/** Labelled range slider used across tour steps. */
export function LabeledRange({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  accent,
}: {
  label: React.ReactNode;
  value: number;
  display: React.ReactNode;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  accent?: string;
}) {
  const id = React.useId();
  return (
    <div className="stack" style={{ ["--gap" as string]: "8px" }}>
      <div className="row-between" style={{ fontSize: 13 }}>
        <label htmlFor={id} className="text-2">
          {label}
        </label>
        <span className="num text-1" style={{ fontWeight: 600 }}>
          {display}
        </span>
      </div>
      <input
        id={id}
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={accent ? { accentColor: accent } : undefined}
      />
    </div>
  );
}
