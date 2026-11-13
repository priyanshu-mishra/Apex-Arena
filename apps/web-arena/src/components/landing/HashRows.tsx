"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { CHAPTER_IDS, COPY } from "@/content/landing";
import { REAL } from "@/lib/canyon/real";
import { type CanyonStore, useCanyon } from "@/lib/canyon/store";
import { cn } from "@/lib/utils";

const c = COPY.c6;

/** `4ee5fa37…58725614`: the hash as shown on narrow screens (12px floor). */
const short = (h: string) => (h.length > 18 ? `${h.slice(0, 8)}…${h.slice(-8)}` : h);

/* Utilities, not the landing module, so the app's proof view can reuse the rows. */
const ROW =
  "grid h-[clamp(30px,4.6vh,46px)] grid-cols-[5.5em_1fr_3.2em] items-center border-b border-rule font-mono text-[length:clamp(8.5px,1.62vw,24px)] leading-none tracking-normal tabular-nums [font-variation-settings:'wdth'_75] transition-opacity duration-[350ms] ease-[cubic-bezier(.2,.7,.1,1)] max-[860px]:h-[26px] max-[860px]:grid-cols-[5em_1fr] max-[860px]:text-[12px]";
const BTN =
  "inline-flex h-[34px] items-center justify-center gap-2.5 whitespace-nowrap rounded-[2px] border border-rule-2 px-4 font-sans text-[13.5px] leading-none font-semibold text-bone no-underline [font-variation-settings:'wdth'_108] transition-[border-color,transform] duration-200 ease-[cubic-bezier(.2,.7,.1,1)] hover:border-bone active:translate-y-px";

/**
 * Five-run proof: one row per run ("run n · hash · match"), dim until lit,
 * and the verdict "n / 5 identical" that turns mint when every row is lit.
 * Under 860px the hash is shortened and the "match" column drops.
 */
export function HashRows({
  hashes,
  lit,
  verdictHref,
  label = c.rowsLabel,
  note,
}: {
  hashes: string[];
  lit: number;
  verdictHref?: string;
  /** Accessible description of the rows (they are one image to assistive tech). */
  label?: string;
  /** Shown between the verdict and the button (the landing's Precise line). */
  note?: ReactNode;
}) {
  const all = hashes.length > 0 && lit >= hashes.length;
  return (
    <div className="border-t border-rule-2">
      <div role="img" aria-label={label}>
        {hashes.map((h, i) => {
          const on = i < lit;
          return (
            <div key={i} className={cn(ROW, on ? "opacity-100" : "opacity-[.16]")} data-on={on || undefined}>
              <span className="text-[12px] text-bone-2 [font-variation-settings:'wdth'_87.5]">
                {c.run} {i + 1}
              </span>
              <span className="overflow-hidden whitespace-nowrap">
                <span className="max-[860px]:hidden">{h}</span>
                <span className="hidden max-[860px]:inline">{short(h)}</span>
              </span>
              <span
                className={cn(
                  "text-right text-[12px] text-bid transition-opacity duration-300 max-[860px]:hidden",
                  on ? "opacity-100" : "opacity-0",
                )}
              >
                {c.match}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-5 pt-4">
        <span
          data-testid="verdict"
          className={cn(
            "font-mono text-[length:clamp(22px,2.5vw,38px)] leading-none font-medium tracking-[-0.03em] [font-variation-settings:'wdth'_80] transition-colors duration-[400ms]",
            all ? "text-bid" : "text-bone-3",
          )}
        >
          {lit} {c.verdict.replace("5", String(hashes.length))}
        </span>
        {/* display: contents, so a hidden note (Plain) takes no row of its own when the line wraps */}
        {note ? <div className="contents [&>*]:min-w-[280px] [&>*]:flex-1">{note}</div> : null}
        {verdictHref ? (
          <Link className={BTN} href={verdictHref}>
            {c.verify}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

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
