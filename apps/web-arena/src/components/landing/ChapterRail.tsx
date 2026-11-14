"use client";

import { CHAPTER_VH, RAIL } from "@/content/landing";
import { useCanyon } from "@/lib/canyon/store";
import s from "./landing.module.css";

/** Chapters after the sticky stages flow under the fixed rail. */
const FIRST_FLOW = Object.keys(CHAPTER_VH).length;

/**
 * Nine ticks for chapters 00–08 (shown at ≥1100px). The active tick widens
 * and shows its label; all labels appear on hover or focus. In the flowing
 * chapters (stack, credit, close) the text scrolls past the rail, so the
 * active label stays hidden there unless the rail is hovered or focused.
 * Labels never take clicks meant for the page underneath. Re-renders only
 * when the chapter index changes, not per scroll frame.
 */
export function ChapterRail() {
  const chapter = useCanyon((st) => st.chapter);
  const active = Math.min(chapter, RAIL.length - 1);
  return (
    <nav className={s.rail} aria-label="Chapters" data-flow={chapter >= FIRST_FLOW ? "" : undefined}>
      {RAIL.map((r, i) => (
        <a key={r.id} href={`#${r.id}`} aria-current={i === active ? "location" : undefined}>
          <span>{r.label}</span>
        </a>
      ))}
    </nav>
  );
}
