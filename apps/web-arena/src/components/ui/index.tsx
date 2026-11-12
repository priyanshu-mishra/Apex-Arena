"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { CONCEPTS, type ConceptKey } from "../../lib/concepts";
import { useArena } from "../../lib/arena";

/* ---------------------------------------------------------------------------
 * Panel — every workspace surface. Pass `explain` to get a "?" toggle that
 * expands a What / How to use / Under the hood callout inside the panel.
 * ------------------------------------------------------------------------- */
export interface ExplainContent {
  what: React.ReactNode;
  how?: React.ReactNode;
  math?: React.ReactNode;
}

export function Panel({
  title,
  subtitle,
  actions,
  explain,
  children,
  bodyClassName,
  flush,
  className,
  style,
  id,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  explain?: ExplainContent;
  children: React.ReactNode;
  bodyClassName?: string;
  flush?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  return (
    <section className={`panel ${className ?? ""}`} style={style} id={id}>
      <header className="panel-header">
        <div className="stack" style={{ ["--gap" as string]: "1px" }}>
          <h3 className="panel-title">{title}</h3>
          {subtitle ? <span className="panel-subtitle">{subtitle}</span> : null}
        </div>
        <div className="panel-actions">
          {actions}
          {explain ? (
            <button
              type="button"
              className="explain-toggle"
              aria-expanded={open}
              aria-controls={regionId}
              aria-label={open ? "Hide explanation" : "Explain this panel"}
              title="Explain this panel"
              onClick={() => setOpen((v) => !v)}
            >
              ?
            </button>
          ) : null}
        </div>
      </header>
      {explain && open ? (
        <div className="explain" id={regionId} role="region" aria-label="Panel explanation">
          <div>
            <h4>What you are looking at</h4>
            <p>{explain.what}</p>
          </div>
          {explain.how ? (
            <div>
              <h4>How to use it</h4>
              <p>{explain.how}</p>
            </div>
          ) : null}
          {explain.math ? (
            <div>
              <h4>Under the hood</h4>
              <p>{explain.math}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={`panel-body ${flush ? "flush" : ""} ${bodyClassName ?? ""}`}>{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * ConceptPill — click (or focus + Enter) to show formula, meaning and the
 * current live interpretation. Closes on outside click / Escape.
 * ------------------------------------------------------------------------- */
export function ConceptPill({
  concept,
  label,
  align = "left",
}: {
  concept: ConceptKey;
  label?: React.ReactNode;
  align?: "left" | "right";
}) {
  const { frame } = useArena();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const c = CONCEPTS[concept] as (typeof CONCEPTS)[ConceptKey] & { live?: (f: typeof frame) => string };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="concept" ref={ref}>
      <button
        type="button"
        className="concept-pill"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={`What is ${c.title}?`}
      >
        {label ?? c.title}
        <span aria-hidden style={{ opacity: 0.6 }}>ⓘ</span>
      </button>
      {open ? (
        <span className="concept-pop" role="dialog" aria-label={c.title} data-align={align}>
          <span className="concept-title">{c.title}</span>
          <span className="concept-formula">{c.formula}</span>
          <span className="concept-body">{c.body}</span>
          {c.live ? <span className="concept-live">{c.live(frame)}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * KpiCard — hero metric with label, big mono value, sub-line, optional action.
 * ------------------------------------------------------------------------- */
export function KpiCard({
  label,
  value,
  sub,
  accent,
  concept,
  footer,
  valueColor,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "bid" | "ask" | "evm" | "chaos" | "llm" | "regime";
  concept?: ConceptKey;
  footer?: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="kpi-card" data-accent={accent}>
      <div className="row-between">
        <span className="kpi-label">{label}</span>
        {concept ? <ConceptPill concept={concept} label="?" align="right" /> : null}
      </div>
      <div className="kpi-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
      {footer}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Small atoms
 * ------------------------------------------------------------------------- */
export function Badge({
  tone,
  children,
  title,
}: {
  tone?: "bid" | "ask" | "evm" | "chaos" | "llm" | "regime";
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span className={`badge ${tone ? `badge-${tone}` : ""}`} title={title}>
      {children}
    </span>
  );
}

export function Meter({
  value,
  max = 1,
  tone = "bid",
  label,
}: {
  value: number;
  max?: number;
  tone?: "bid" | "ask" | "evm" | "chaos" | "llm" | "regime";
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="meter"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className="meter-fill" style={{ width: `${pct}%`, ["--accent" as string]: `var(--${tone})` }} />
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" className="tab" aria-selected={t.id === value} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Animated tone for a value that just changed direction. */
export function useDelta(value: number): number {
  const prev = useRef(value);
  const [delta, setDelta] = useState(0);
  useEffect(() => {
    setDelta(value - prev.current);
    prev.current = value;
  }, [value]);
  return delta;
}
