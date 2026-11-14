"use client";

import { useArena } from "../../lib/arena";
import { cn } from "../../lib/utils";
import { ConceptPill, KpiCard, Meter, Panel } from "../ui";
import { caption, subhead } from "../ui/kit";
import { FAST_TICK_MS, TICKS_PER_EPOCH, epochOf, type FrozenDigest } from "./model";

const TRACE_EVERY = 25;

export function BarrierInspector({ digest }: { digest: FrozenDigest | null }) {
  const { frame, paused } = useArena();
  const pos = frame.tick % TICKS_PER_EPOCH;
  const epoch = epochOf(frame.tick);
  const ticksLeft = TICKS_PER_EPOCH - pos;
  const nextTrace = TRACE_EVERY - (pos % TRACE_EVERY);

  return (
    <Panel
      title="Synchronization barrier"
      subtitle="Where the fast market loop is inside the current one-second macro epoch"
      explain={{
        what: (
          <>
            ApexArena runs two clocks. The fast loop advances every 10 ms of virtual time: it matches CLOB orders, executes Revm swaps,
            steps the background ABIDES agents and updates Hawkes λ(t). Every 100 fast ticks (1,000 ms) the slow macro barrier freezes the
            arena, compiles a MacroDigest and hands it to the reasoning agents.
          </>
        ),
        how: (
          <>
            The tick strip on the MacroDigest panel sweeps one epoch; the amber note shows while the market is held at the barrier. This
            browser simulation emits LLM reasoning traces every 25 ticks. Pause the arena from the top bar to stop the sweep and inspect one
            tick.
          </>
        ),
        math: (
          <>
            epoch = ⌊tick / 100⌋, virtual_ts_ns = tick × 10,000,000. Agent decisions are applied as a batch at the barrier, so an LLM that
            takes 4 seconds to answer gets exactly the same market state as one that answers in 40 ms. That is what keeps replays
            bit-for-bit identical.
          </>
        ),
      }}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <KpiCard label="Macro epoch" value={epoch.toLocaleString("en-US")} sub={<>tick {frame.tick.toLocaleString("en-US")}</>} />
          <KpiCard
            label="Fast tick in epoch"
            value={
              <>
                {pos}
                <span className="text-[15px] text-bone-3"> / 100</span>
              </>
            }
            sub={<>{(pos * FAST_TICK_MS).toLocaleString("en-US")} of 1,000 ms virtual</>}
          />
          <KpiCard
            label="Next digest in"
            value={
              <>
                {ticksLeft}
                <span className="text-[15px] text-bone-3"> ticks</span>
              </>
            }
            sub={paused ? "arena paused" : <>{ticksLeft * FAST_TICK_MS} ms virtual · next trace in {nextTrace}</>}
          />
        </div>

        <Meter value={pos} max={TICKS_PER_EPOCH} label="Progress to the next macro barrier" />

        <div className="grid grid-cols-1 border-t border-rule-2 md:grid-cols-2">
          <div className="flex flex-col gap-2 border-b border-rule py-3.5 md:border-r md:border-b-0 md:pr-5">
            <span className={subhead}>Fast loop, every 10 ms</span>
            <span className="font-sans text-[13.5px] leading-[1.5] text-bone-2">
              CLOB matching, Revm swaps, background ABIDES agents and the <ConceptPill concept="hawkes" label="Hawkes λ(t)" /> update.
            </span>
          </div>
          <div className="flex flex-col gap-2 py-3.5 md:pl-5">
            <span className={subhead}>Macro barrier, every 1,000 ms</span>
            <span className="font-sans text-[13.5px] leading-[1.5] text-bone-2">
              The arena freezes, a <ConceptPill concept="macroDigest" /> is compiled, and LLM, MCP and RL agents answer with a batch of
              orders.
            </span>
          </div>
        </div>

        <p className={cn(caption)} aria-live="polite">
          {digest
            ? `Last digest frozen at tick ${digest.frozenAtTick.toLocaleString("en-US")} (epoch ${digest.json.epoch_index}).`
            : "Waiting for the first barrier."}
        </p>
      </div>
    </Panel>
  );
}
