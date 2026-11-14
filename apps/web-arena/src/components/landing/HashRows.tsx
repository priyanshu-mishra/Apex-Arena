"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { COPY } from "@/content/landing";
import { cn } from "@/lib/utils";

const c = COPY.c6;

/** A run not yet made: a dotted row the length of a SHA-256 hex hash. */
export const PENDING_HASH = "·".repeat(64);

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
 *
 * `matches` marks each run against run 1: a run that
 * differs reads "differs" in vermilion, the verdict counts the matching runs
 * and turns vermilion when any run differs.
 */
export function HashRows({
  hashes,
  lit,
  verdictHref,
  label = c.rowsLabel,
  note,
  matches,
}: {
  hashes: string[];
  lit: number;
  verdictHref?: string;
  /** Accessible description of the rows (they are one image to assistive tech). */
  label?: string;
  /** Shown between the verdict and the button (the landing's Precise line). */
  note?: ReactNode;
  /** Per-run agreement with run 1 (the landing passes real.json's, the app its live check). */
  matches?: boolean[];
}) {
  const all = hashes.length > 0 && lit >= hashes.length;
  const failed = all && matches !== undefined && matches.some((m) => !m);
  const count = matches && all ? matches.filter(Boolean).length : lit;
  return (
    <div className="border-t border-rule-2">
      <div role="img" aria-label={label}>
        {hashes.map((h, i) => {
          const on = i < lit;
          const differs = matches !== undefined && matches[i] === false;
          return (
            <div key={i} className={cn(ROW, on ? "opacity-100" : "opacity-[.16]")} data-on={on || undefined} data-testid="hash-row">
              <span className="text-[12px] text-bone-2 [font-variation-settings:'wdth'_87.5]">
                {c.run} {i + 1}
              </span>
              <span className="overflow-hidden whitespace-nowrap">
                <span className="max-[860px]:hidden">{h}</span>
                <span className="hidden max-[860px]:inline">{short(h)}</span>
              </span>
              <span
                className={cn(
                  "text-right text-[12px] transition-opacity duration-300 max-[860px]:hidden",
                  differs ? "text-ask" : "text-bid",
                  on ? "opacity-100" : "opacity-0",
                )}
              >
                {differs ? "differs" : c.match}
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
            failed ? "text-ask" : all ? "text-bid" : "text-bone-3",
          )}
        >
          {count} {c.verdict.replace("5", String(hashes.length))}
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
