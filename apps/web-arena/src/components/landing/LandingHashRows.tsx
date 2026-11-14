"use client";

import { type ReactNode, useEffect, useState } from "react";
import { CHAPTER_IDS, COPY } from "@/content/landing";
import { REAL } from "@/lib/canyon/real";
import { type CanyonStore, useCanyon } from "@/lib/canyon/store";
import { HashRows } from "./HashRows";

const c = COPY.c6;

const PROOF = CHAPTER_IDS.indexOf("c6");
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Guide §4: rows 1–5 light between 6% and 56% of chapter 06 (all lit once past it). */
const litFor = (st: CanyonStore, n: number) =>
  st.chapter === PROOF
    ? Math.floor(clamp01(((st.progress[PROOF] ?? 0) - 0.06) / 0.5) * n + 0.001)
    : st.chapter > PROOF
      ? n
      : 0;

/** The landing's 06 Proof rows: the real hash five times, lit by scroll. */
export function LandingHashRows({ note }: { note?: ReactNode }) {
  const hashes = [REAL.hash, REAL.hash, REAL.hash, REAL.hash, REAL.hash];
  const [lit, setLit] = useState(0);
  useEffect(() => {
    // State changes only when the lit count does (six times across the chapter).
    setLit(litFor(useCanyon.getState(), hashes.length));
    return useCanyon.subscribe((st) => setLit(litFor(st, hashes.length)));
  }, [hashes.length]);
  return <HashRows hashes={hashes} lit={lit} verdictHref={c.verifyHref} note={note} />;
}
