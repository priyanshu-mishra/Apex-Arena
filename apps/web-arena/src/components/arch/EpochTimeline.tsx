"use client";

import { Badge, ConceptPill, Panel } from "../ui";
import { useArena } from "../../lib/arena";
import { cn } from "../../lib/utils";
import { AppTickStrip } from "../lab/AppTickStrip";
import { caption, codeInline, label, num, subhead } from "../ui/kit";

const EPOCH = 100;

/** Live view of the dual-speed clock: 100 fast ticks of 10 ms, then a macro barrier. */
export function EpochTimeline() {
  const { frame, paused } = useArena();
  const tick = frame.tick;
  const pos = tick % EPOCH; // 0 = barrier just fired
  const epoch = Math.floor(tick / EPOCH);
  const toNext = pos === 0 ? 0 : EPOCH - pos;
  const lastTrace = frame.reasoningTraces[0];
  const virtualMs = tick * 10;

  return (
    <Panel
      title="Dual-speed clock"
      subtitle="Fast microstructure loop vs. slow reasoning epoch, driven by the live simulation."
      explain={{
        what: "Real LLMs need about a second to think; HFT bots react in milliseconds. ApexArena reconciles them with a synchronization barrier on a virtual clock.",
        how: "Watch the tick strip fill as fast ticks run. When it reaches 100 the market is held (the amber note), reasoning agents receive a MacroDigest, and their decisions apply before the next tick.",
        math: "virtual_ts_ns advances by FAST_TICK_NS = 10,000,000 per tick. The barrier fires when tick % MACRO_EPOCH_TICKS (100) == 0. Wall-clock latency of an agent never changes the outcome.",
      }}
      actions={<Badge tone={paused ? "chaos" : "bid"}>{paused ? "paused" : "live"}</Badge>}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className={cn(caption, "flex flex-wrap gap-x-5 gap-y-1")}>
            <span>
              Tick <span className={cn(num, "text-bone")}>{tick.toLocaleString("en-US")}</span>
            </span>
            <span>
              Epoch <span className={cn(num, "text-bone")}>{epoch.toLocaleString("en-US")}</span>
            </span>
            <span>
              Virtual time <span className={cn(num, "text-bone")}>{(virtualMs / 1000).toFixed(2)} s</span>
            </span>
          </div>
          <span className={caption}>
            Next <ConceptPill concept="macroDigest" label="MacroDigest" /> in <span className={cn(num, "text-bone")}>{toNext}</span> ticks (
            <span className={num}>{toNext * 10}</span> ms)
          </span>
        </div>

        <div role="img" aria-label={`Fast tick ${pos} of ${EPOCH} in epoch ${epoch}. Macro barrier in ${toNext} ticks.`}>
          <AppTickStrip pos={pos} held={pos === 0} />
        </div>

        <div className="grid grid-cols-1 border-t border-rule-2 md:grid-cols-2">
          <div className="flex flex-col gap-2 border-b border-rule py-3.5 md:border-r md:border-b-0 md:pr-5">
            <span className={subhead}>Every fast tick (10 ms)</span>
            <ol className="flex list-decimal flex-col gap-1 pl-5 font-sans text-[13.5px] leading-[1.5] text-bone-2 marker:font-mono marker:text-[12px] marker:text-bone-3">
              <li>Chaos engine steps the Markov regime and decays Hawkes intensity λ(t).</li>
              <li>Background agents (value, momentum, Avellaneda-Stoikov MM, noise, HFT) quote and trade.</li>
              <li>Orders match on the CLOB; swaps execute inside revm.</li>
              <li>Every portfolio is marked to market; margin breaches are liquidated.</li>
            </ol>
          </div>
          <div className="flex flex-col gap-2 py-3.5 md:pl-5">
            <span className={subhead}>Every 100th tick (1,000 ms)</span>
            <ol className="flex list-decimal flex-col gap-1 pl-5 font-sans text-[13.5px] leading-[1.5] text-bone-2 marker:font-mono marker:text-[12px] marker:text-bone-3">
              <li>The arena freezes and compiles a deterministic MacroDigest.</li>
              <li>Reasoning agents (LLM, MCP, RL) receive the identical digest.</li>
              <li>Their batch of decisions is applied atomically.</li>
              <li>The fast loop resumes — no agent ever trades on stale prices.</li>
            </ol>
          </div>
        </div>

        {lastTrace ? (
          <div className="flex flex-col gap-1.5">
            <span className={label}>Last macro decision</span>
            <p className="font-sans text-[13.5px] leading-[1.5] text-bone-2">
              <span className="font-semibold text-bone">{lastTrace.agentId}</span>{" "}
              <span className={caption}>
                at tick <span className={num}>{lastTrace.tick}</span>:
              </span>{" "}
              {lastTrace.thoughtSummary} <code className={codeInline}>{lastTrace.toolAction}</code>
            </p>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
