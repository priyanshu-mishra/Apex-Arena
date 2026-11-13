"use client";

import { fmtUsd, useArena, USER_AGENT_ID } from "@/lib/arena";
import { Pro, useDensity } from "@/lib/density";
import { cn } from "@/lib/utils";
import { regimeWord } from "./chrome";

const num = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const tick = (n: number) => String(Math.max(0, Math.floor(n))).padStart(6, "0");

/** One cell of the line: rule on the left, 16px sides (10px on phones). */
const CELL =
  "flex h-full shrink-0 items-center gap-2 border-l border-rule px-4 first:border-l-0 first:pl-0 max-[520px]:px-2.5 max-[520px]:first:pl-0";
/** Dropped under 860px, as on the landing. */
const OPT = "max-[860px]:hidden";
/** Dropped under 520px. */
const OPT2 = "max-[520px]:hidden";

/**
 * The landing's status line, carried into the app one-to-one in place of the
 * old status bar: seed, tick, ETH, spread, λ, regime, playback, your desk and
 * (Pro) the in-browser state digest. 38px, Martian Mono 12px, bone-2 labels
 * with bone values. `aria-live="off"`: it updates every frame and must not
 * chatter; the regime is a word, never colour alone.
 */
export function AppStatusLine() {
  const { frame, paused, speed } = useArena();
  const [density] = useDensity();
  const you = frame.leaderboard.find((e) => e.agentId === USER_AGENT_ID);
  const rank = you ? frame.leaderboard.indexOf(you) + 1 : 0;
  const hot = frame.regime !== "CALM";
  const lambda = frame.hawkesIntensityPips / 1e8;

  return (
    <footer
      data-chrome
      role="status"
      aria-live="off"
      aria-label="Market status"
      className="sticky bottom-0 z-30 flex h-[38px] items-center overflow-hidden border-t border-rule bg-ink px-[clamp(16px,3.9vw,56px)] font-mono text-[12px] leading-none whitespace-nowrap text-bone-2 tabular-nums [font-variation-settings:'wdth'_87.5] print:hidden [&_b]:font-medium [&_b]:text-bone"
    >
      <div className={cn(CELL, OPT2)}>
        seed <b>42</b>
      </div>
      {/* First visible cell on phones, where seed drops out. */}
      <div className={cn(CELL, "max-[520px]:border-l-0 max-[520px]:pl-0")}>
        tick <b data-testid="sim-tick">{tick(frame.tick)}</b>
      </div>
      <div className={CELL}>
        ETH <b>{num(frame.clobMidUsd)}</b>
      </div>
      <div className={cn(CELL, OPT)}>
        spread <b>{num(frame.spreadBps, 1)}</b> bps
      </div>
      <div className={cn(CELL, OPT)}>
        λ <b>{num(lambda)}</b>
      </div>
      <div className={CELL} data-hot={hot ? "" : undefined}>
        <span aria-hidden className={cn("size-1.5 rounded-[50%] transition-colors duration-300", hot ? "bg-shock" : "bg-bid")} />
        <b className={cn("transition-colors duration-300", hot && "text-shock!")}>{regimeWord(frame.regime)}</b>
      </div>
      <div className={cn(CELL, OPT2)} title="Pause / resume with Space; step one tick with .">
        <b data-testid="sim-state">{paused ? "paused" : "running"}</b>
        {num(speed, 0)}×
      </div>
      {you ? (
        <div className={cn(CELL, OPT)}>
          you <b>{fmtUsd(you.equityUsd, 0)}</b>
          rank <b>{rank}</b> of {frame.leaderboard.length}
        </div>
      ) : null}
      <Pro>
        <div
          className={cn(CELL, OPT)}
          data-testid="status-digest"
          title={`${frame.stateHash}\nIn-browser kernel: 256-bit FNV-1a state digest, ${
            frame.sharedBufferActive ? "SharedArrayBuffer" : "ring buffer"
          } pipeline. The native Rust kernel uses SHA-256 (see Proof).`}
        >
          digest <b>{frame.stateHash.slice(0, 12)}</b>
        </div>
      </Pro>
      <div className="flex-1" />
      {/* Last to go: Pro's digest cell needs the room first. */}
      <div className={cn(CELL, density === "pro" ? "max-[1599px]:hidden" : "max-[1179px]:hidden")}>
        simulated in your browser
      </div>
    </footer>
  );
}
