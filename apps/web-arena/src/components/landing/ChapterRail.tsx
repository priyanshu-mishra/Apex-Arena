"use client";

import { RAIL } from "@/content/landing";
import { useCanyon } from "@/lib/canyon/store";
import s from "./landing.module.css";

/**
 * Nine ticks for chapters 00–08 (shown at ≥1100px). The active tick widens
 * and shows its label; all labels appear on hover or focus. Re-renders only
 * when the chapter index changes, not per scroll frame.
 */
export function ChapterRail() {
  const active = useCanyon((st) => Math.min(st.chapter, RAIL.length - 1));
  return (
    <nav className={s.rail} aria-label="Chapters">
      {RAIL.map((r, i) => (
        <a key={r.id} href={`#${r.id}`} aria-current={i === active ? "location" : undefined}>
          <span>{r.label}</span>
        </a>
      ))}
    </nav>
  );
}
