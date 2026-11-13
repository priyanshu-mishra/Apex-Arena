"use client";

import Link from "next/link";
import { TOP_BAR } from "@/content/landing";
import { cn } from "@/lib/utils";
import s from "./landing.module.css";
import { useDepth } from "./useDepth";

/** Stepped-canyon glyph: two stepped walls meeting at the floor. */
export function CanyonGlyph() {
  return (
    <svg viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M1 1h4v4h3v4h2v4" />
      <path d="M21 1h-4v4h-3v4h-2v4" />
    </svg>
  );
}

export function TopBar() {
  const [depth, setDepth] = useDepth();
  return (
    <header className={s.top}>
      <a className={s.mark} href="#c0" aria-label={`${TOP_BAR.wordmark}, back to top`}>
        <CanyonGlyph />
        {TOP_BAR.wordmark}
      </a>
      <span className={s.spacer} />
      <div className={s.depth} role="group" aria-label={TOP_BAR.depthLabel}>
        <button type="button" aria-pressed={depth === "plain"} onClick={() => setDepth("plain")}>
          {TOP_BAR.plain}
        </button>
        <button type="button" aria-pressed={depth === "precise"} onClick={() => setDepth("precise")}>
          {TOP_BAR.precise}
        </button>
      </div>
      <Link className={cn(s.btn, s.pri)} href="/enter">
        {TOP_BAR.cta}
      </Link>
    </header>
  );
}
