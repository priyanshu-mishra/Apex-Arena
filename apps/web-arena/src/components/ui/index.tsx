"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { CONCEPTS, type ConceptKey } from "../../lib/concepts";
import { useArena } from "../../lib/arena";
import { cn } from "../../lib/utils";
import { bigNum, btn, caption, dot, label as labelCls, mono12, subhead, toneColor, type Tone } from "./kit";

export { type Tone } from "./kit";

/* ---------------------------------------------------------------------------
 * Panel — every app surface, in the landing's language (guide §5): a
 * hairline-ruled strip, never a box. A rule-2 hairline on top, then the label
 * row (13px Archivo title, wght 600, wdth 108; subtitle; actions; the "?"
 * toggle), then the content on the page ground. No border around it, no fill,
 * no radius, no shadow. It is a labelled region named by its title. Pass
 * `explain` to get a "?" toggle that expands a What / How to use / Under the
 * hood note under the label row.
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
  const titleId = useId();
  return (
    <section
      className={cn("flex min-w-0 flex-col border-t border-rule-2", className)}
      style={style}
      id={id}
      aria-labelledby={titleId}
      data-panel=""
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 pt-3 pb-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 id={titleId} className={subhead}>
            {title}
          </h2>
          {subtitle ? <span className={cn(caption, "text-bone-2")}>{subtitle}</span> : null}
        </div>
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          {actions}
          {explain ? (
            <button
              type="button"
              className={btn("ghost", "sm", "w-[30px] px-0 font-mono text-[13px]")}
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
        <div
          className="grid gap-4 border-y border-rule py-4 md:grid-cols-3"
          id={regionId}
          role="region"
          aria-label="Panel explanation"
        >
          <ExplainPart title="What you are looking at">{explain.what}</ExplainPart>
          {explain.how ? <ExplainPart title="How to use it">{explain.how}</ExplainPart> : null}
          {explain.math ? <ExplainPart title="Under the hood">{explain.math}</ExplainPart> : null}
        </div>
      ) : null}
      <div className={cn("min-w-0 flex-1", flush ? "" : "pt-1 pb-4", bodyClassName)}>{children}</div>
    </section>
  );
}

function ExplainPart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h3 className={labelCls}>{title}</h3>
      <p className="font-sans text-[13.5px] leading-[1.55] text-bone text-pretty [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-bone [&_code]:[font-variation-settings:'wdth'_87.5]">
        {children}
      </p>
    </div>
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
    <span className="relative inline-flex align-baseline" ref={ref}>
      <button
        type="button"
        className="inline-flex items-baseline gap-1 border-b border-dotted border-bone-3 font-sans text-[12.5px] leading-[1.35] text-bone-2 transition-colors hover:border-bone hover:text-bone aria-expanded:border-bone aria-expanded:text-bone"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={`What is ${c.title}?`}
      >
        {label ?? c.title}
      </button>
      {open ? (
        <span
          className={cn(
            "absolute top-[calc(100%+8px)] z-30 flex w-[min(320px,calc(100vw-48px))] flex-col gap-2 rounded-[2px] border border-rule-2 bg-ink-2 p-3.5 text-left",
            align === "right" ? "right-0" : "left-0",
          )}
          role="dialog"
          aria-label={c.title}
        >
          <span className={subhead}>{c.title}</span>
          <span className={cn(mono12, "text-bone break-words")}>{c.formula}</span>
          <span className="font-sans text-[13px] leading-[1.5] text-bone-2">{c.body}</span>
          {c.live ? (
            <span className="border-t border-rule pt-2 font-sans text-[13px] leading-[1.5] text-bone">{c.live(frame)}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * KpiCard — a landing readout: caption, big numeral, mono sub-line. No box;
 * a 1px rule sits on top. `accent` colours only a small data dot.
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
  accent?: Tone;
  concept?: ConceptKey;
  footer?: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5 border-t border-rule-2 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn(labelCls, "flex items-center gap-2")}>
          {accent ? <span className={dot} style={{ background: toneColor(accent) }} aria-hidden /> : null}
          {label}
        </span>
        {concept ? <ConceptPill concept={concept} label="?" align="right" /> : null}
      </div>
      <div className={cn(bigNum, "min-w-0 break-words")} style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      {sub ? <div className={cn(mono12, "flex flex-wrap items-center gap-2 text-bone-2")}>{sub}</div> : null}
      {footer}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Small atoms
 * ------------------------------------------------------------------------- */
export function Badge({ tone, children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span
      className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-[2px] border border-rule px-2 font-mono text-[12px] leading-none whitespace-nowrap text-bone-2 [font-variation-settings:'wdth'_87.5]"
      title={title}
    >
      {tone ? <span className={dot} style={{ background: toneColor(tone) }} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Meter({ value, max = 1, tone, label }: { value: number; max?: number; tone?: Tone; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="relative h-[3px] w-full overflow-hidden bg-rule"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: tone ? toneColor(tone) : "var(--bone)" }} />
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[20px] items-center rounded-[2px] border border-rule-2 px-1.5 font-mono text-[12px] leading-none text-bone-2 [font-variation-settings:'wdth'_87.5]">
      {children}
    </kbd>
  );
}

/** Joined rectangular buttons in one outline (the landing mood selector); pressed = bone fill. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("inline-flex max-w-full overflow-x-auto rounded-[2px] border border-rule-2 [scrollbar-width:none]", className)}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className="h-[30px] shrink-0 border-r border-rule px-3 font-sans text-[13px] leading-none font-semibold whitespace-nowrap text-bone-2 transition-colors [font-variation-settings:'wdth'_108] last:border-r-0 hover:text-bone aria-pressed:bg-bone aria-pressed:text-ink"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Text tabs like the app nav: bone-2, the current one bone with a 1px bone underline. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: { id: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      className="flex max-w-full gap-5 overflow-x-auto border-b border-rule [scrollbar-width:none]"
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          onClick={() => onChange(t.id)}
          className="-mb-px h-[40px] shrink-0 border-b border-transparent font-sans text-[13.5px] leading-none font-semibold whitespace-nowrap text-bone-2 transition-colors [font-variation-settings:'wdth'_108] hover:text-bone aria-selected:border-bone aria-selected:text-bone"
        >
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
