"use client";

import { COPY } from "@/content/landing";
import { useCanyon } from "@/lib/canyon/store";
import s from "./landing.module.css";

const c = COPY.c3;

/**
 * 03 Chaos: four joined buttons that set the market's mood. The pressed one
 * follows the store, which the scene resets to calm when a regime ends.
 */
export function MoodSelector() {
  const mood = useCanyon((st) => st.mood);
  return (
    <div className={s.moods} role="group" aria-label={c.groupLabel}>
      {c.moods.map((m) => (
        <button
          key={m.mood}
          type="button"
          aria-pressed={mood === m.mood}
          onClick={() => useCanyon.getState().setMood(m.mood)}
        >
          <b>{m.name}</b>
          <span>{m.sub}</span>
        </button>
      ))}
    </div>
  );
}
