"use client";

import type React from "react";

import { cn } from "../../lib/utils";
import { Panel } from "../ui";
import { mono12 } from "../ui/kit";

/** Observed with `target/debug/apex-tui --verify-determinism --seed 42 --ticks 300`. */
export const REFERENCE_HASH_SEED42_T300 = "4ee5fa377dd4d01d6225c6dd5f4f8f7a2d9cda7db63319e71f3d1c1458725614";

const INVARIANTS: { title: React.ReactNode; where: string[] }[] = [
  {
    title: (
      <>
        Bit-for-bit determinism: five runs of seed 42 for 300 ticks all hash to{" "}
        <span className={cn(mono12, "text-bone")} title={REFERENCE_HASH_SEED42_T300}>
          {REFERENCE_HASH_SEED42_T300.slice(0, 8)}…{REFERENCE_HASH_SEED42_T300.slice(-4)}
        </span>
        .
      </>
    ),
    where: ["scripts/verify_determinism_hook.sh", "crates/apex-kernel/tests/determinism_suite.rs"],
  },
  {
    title: "Fixed-point only: prices and quantities are i64 pips with SCALE = 10⁸; products widen to i128. No f32 / f64 in core state, matching, AMM math or accounting.",
    where: ["crates/apex-types/src/lib.rs"],
  },
  {
    title: "Ordered collections only: BTreeMap / BTreeSet everywhere in core state, so iteration and hashing order are fixed. The gate rejects any HashMap / HashSet.",
    where: ["crates/apex-clob/src/lib.rs", "scripts/verify_determinism_hook.sh"],
  },
  {
    title: "One seeded RNG: ChaCha8Rng::seed_from_u64(seed) drives every random draw; thread_rng is banned by the gate.",
    where: ["crates/apex-kernel/src/lib.rs"],
  },
  {
    title: "Virtual time only: the clock is virtual_ts_ns += 10,000,000 per tick. SystemTime::now and Instant::now never appear in simulation crates.",
    where: ["crates/apex-kernel/src/lib.rs", "crates/apex-types/src/lib.rs"],
  },
  {
    title: "Monotonic chart time: every frame advances tick and timeSec, and history is de-duplicated before it reaches lightweight-charts.",
    where: ["apps/web-arena/src/lib/arena.tsx"],
  },
];

export function InvariantsList() {
  return (
    <Panel
      title="Invariants we never break"
      subtitle="Each one is enforced in code or by the pre-merge determinism gate — not by convention."
      explain={{
        what: "The rules that make a trading benchmark trustworthy: if any of them slipped, two runs of the same seed could disagree and every score would be noise.",
        how: "Run ./scripts/verify_determinism_hook.sh from the repo root. It greps the core crates for banned APIs, then runs the 5-run SHA-256 suite.",
      }}
    >
      <div className="border-t border-rule-2">
        {INVARIANTS.map((inv, i) => (
          <div key={i} className="grid grid-cols-1 gap-x-6 gap-y-2 border-b border-rule py-3.5 md:grid-cols-[2.5em_minmax(0,1fr)_minmax(0,22em)]">
            <span className={cn(mono12, "text-bone-3")} aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-sans text-[14px] leading-[1.55] text-bone">{inv.title}</span>
            <span className="flex flex-col gap-0.5">
              {inv.where.map((w) => (
                <span key={w} className={cn(mono12, "break-all text-bone-2")}>
                  {w}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
