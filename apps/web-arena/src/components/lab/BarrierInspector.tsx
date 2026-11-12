"use client";

import { memo } from "react";
import { useArena } from "../../lib/arena";
import { ConceptPill, Meter, Panel } from "../ui";
import { FAST_TICK_MS, TICKS_PER_EPOCH, epochOf, type FrozenDigest } from "./model";
import styles from "./Lab.module.css";

const TRACE_EVERY = 25;

const Strip = memo(function Strip({ pos }: { pos: number }) {
  const cells = [];
  for (let i = 0; i < TICKS_PER_EPOCH; i++) {
    let cls = styles.cell;
    if (i === pos) cls += ` ${styles.cellNow}`;
    else if (i === 0) cls += ` ${styles.cellBarrier}`;
    else if (i % TRACE_EVERY === 0) cls += ` ${i < pos ? styles.cellTraceDone : styles.cellTrace}`;
    else if (i < pos) cls += ` ${styles.cellDone}`;
    cells.push(<span key={i} className={cls} />);
  }
  return (
    <div className={styles.strip} aria-hidden>
      {cells}
    </div>
  );
});

export function BarrierInspector({ digest }: { digest: FrozenDigest | null }) {
  const { frame, paused } = useArena();
  const pos = frame.tick % TICKS_PER_EPOCH;
  const epoch = epochOf(frame.tick);
  const ticksLeft = TICKS_PER_EPOCH - pos;

  return (
    <Panel
      title="Dual-speed synchronization barrier"
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
            Watch the white cursor sweep the strip. The amber cell is the barrier where the next digest is frozen; the violet cells mark
            ticks where this browser simulation emits LLM reasoning traces (every 25 ticks). Pause the arena from the top bar to stop the
            sweep and inspect one tick.
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
      <div className="stack" style={{ ["--gap" as string]: "16px" }}>
        <div className={styles.barrierTop}>
          <div className={styles.stat}>
            <span className="label">Macro epoch</span>
            <span className={styles.statValue}>{epoch.toLocaleString("en-US")}</span>
            <span className={styles.statSub}>
              tick <span className="num">{frame.tick.toLocaleString("en-US")}</span>
            </span>
          </div>
          <div className={styles.stat}>
            <span className="label">Fast tick in epoch</span>
            <span className={styles.statValue}>
              {pos}
              <span style={{ color: "var(--text-4)", fontSize: 14, fontWeight: 500 }}> / 100</span>
            </span>
            <span className={styles.statSub}>
              <span className="num">{(pos * FAST_TICK_MS).toLocaleString("en-US")}</span> of 1,000 ms virtual time
            </span>
          </div>
          <div className={styles.stat}>
            <span className="label">Next digest in</span>
            <span className={styles.statValue}>
              {ticksLeft} <span style={{ color: "var(--text-4)", fontSize: 14, fontWeight: 500 }}>ticks</span>
            </span>
            <span className={styles.statSub}>
              {paused ? "Arena paused" : <><span className="num">{ticksLeft * FAST_TICK_MS}</span> ms of virtual time</>}
            </span>
          </div>
        </div>

        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <Strip pos={pos} />
          <div className={styles.stripScale} aria-hidden>
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>99</span>
          </div>
        </div>

        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <div className="row-between">
            <span className="label">Progress to the next barrier</span>
            <span className="caption num">{pos}%</span>
          </div>
          <div className={styles.progressFill}>
            <Meter value={pos} max={TICKS_PER_EPOCH} tone="evm" label="Progress to the next macro barrier" />
          </div>
        </div>

        <div className={styles.legend}>
          <span>
            <span className={styles.legendSwatch} style={{ background: "var(--chaos)" }} />
            Barrier: digest frozen
          </span>
          <span>
            <span className={styles.legendSwatch} style={{ background: "var(--llm)" }} />
            LLM trace emitted
          </span>
          <span>
            <span className={styles.legendSwatch} style={{ background: "rgba(56, 189, 248, 0.45)" }} />
            Fast ticks elapsed
          </span>
          <span>
            <span className={styles.legendSwatch} style={{ background: "var(--text)" }} />
            Current tick
          </span>
        </div>

        <div className={styles.loops}>
          <div className={styles.loop}>
            <span className={styles.loopTitle}>Fast loop, every 10 ms</span>
            <span className={styles.loopBody}>
              CLOB matching, Revm swaps, background ABIDES agents and the <ConceptPill concept="hawkes" label="Hawkes λ(t)" /> update.
            </span>
          </div>
          <div className={styles.loop}>
            <span className={styles.loopTitle}>Macro barrier, every 1,000 ms</span>
            <span className={styles.loopBody}>
              The arena freezes, a <ConceptPill concept="macroDigest" /> is compiled, and LLM, MCP and RL agents answer with a batch of
              orders.
            </span>
          </div>
        </div>

        <p className="caption" aria-live="polite">
          {digest
            ? `Last digest frozen at tick ${digest.frozenAtTick.toLocaleString("en-US")} (epoch ${digest.json.epoch_index}).`
            : "Waiting for the first barrier."}
        </p>
      </div>
    </Panel>
  );
}
