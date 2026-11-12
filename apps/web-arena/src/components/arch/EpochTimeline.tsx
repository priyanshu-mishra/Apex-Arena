"use client";

import { Badge, ConceptPill, Panel } from "../ui";
import { useArena } from "../../lib/arena";
import s from "./arch.module.css";

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
        how: "Watch the amber bars fill as fast ticks run. When they reach the violet barrier the arena freezes, reasoning agents receive a MacroDigest, and their decisions apply before the next tick.",
        math: "virtual_ts_ns advances by FAST_TICK_NS = 10,000,000 per tick. The barrier fires when tick % MACRO_EPOCH_TICKS (100) == 0. Wall-clock latency of an agent never changes the outcome.",
      }}
      actions={<Badge tone={paused ? "chaos" : "bid"}>{paused ? "Paused" : "Live"}</Badge>}
    >
      <div className="stack" style={{ ["--gap" as string]: "18px" }}>
        <div className="row-between wrap">
          <div className="row wrap" style={{ gap: 20 }}>
            <span className="caption">
              Tick <span className="num text-1">{tick.toLocaleString("en-US")}</span>
            </span>
            <span className="caption">
              Epoch <span className="num text-1">{epoch.toLocaleString("en-US")}</span>
            </span>
            <span className="caption">
              Virtual time <span className="num text-1">{(virtualMs / 1000).toFixed(2)} s</span>
            </span>
          </div>
          <span className="caption">
            Next <ConceptPill concept="macroDigest" label="MacroDigest" /> in{" "}
            <span className="num text-1">{toNext}</span> ticks (<span className="num">{toNext * 10}</span> ms)
          </span>
        </div>

        <div
          className={s.timeline}
          role="img"
          aria-label={`Fast tick ${pos} of ${EPOCH} in epoch ${epoch}. Macro barrier in ${toNext} ticks.`}
        >
          {Array.from({ length: EPOCH }, (_, i) => {
            const n = i + 1;
            const barrier = n === EPOCH;
            return (
              <span
                key={n}
                className={s.tickBar}
                data-past={!barrier && n < pos}
                data-current={!barrier && n === pos}
                data-barrier={barrier}
              />
            );
          })}
        </div>
        <div className="row-between">
          <span className="caption">
            <span className="dot" style={{ ["--accent" as string]: "var(--chaos)", marginRight: 6 }} />
            Fast tick · Δt = <span className="num">10 ms</span>
          </span>
          <span className="caption">
            Macro barrier · ΔT = <span className="num">1,000 ms</span>
            <span className="dot" style={{ ["--accent" as string]: "var(--llm)", marginLeft: 6 }} />
          </span>
        </div>

        <div className={s.epochCols}>
          <div className="callout callout-chaos">
            <div className="stack" style={{ ["--gap" as string]: "8px" }}>
              <strong className="text-1" style={{ fontSize: 14 }}>
                Every fast tick (10 ms)
              </strong>
              <ol className={s.stepList}>
                <li>Chaos engine steps the Markov regime and decays Hawkes intensity λ(t).</li>
                <li>Background agents (value, momentum, Avellaneda-Stoikov MM, noise, HFT) quote and trade.</li>
                <li>Orders match on the CLOB; swaps execute inside revm.</li>
                <li>Every portfolio is marked to market; margin breaches are liquidated.</li>
              </ol>
            </div>
          </div>
          <div className="callout callout-llm">
            <div className="stack" style={{ ["--gap" as string]: "8px" }}>
              <strong className="text-1" style={{ fontSize: 14 }}>
                Every 100th tick (1,000 ms)
              </strong>
              <ol className={s.stepList}>
                <li>The arena freezes and compiles a deterministic MacroDigest.</li>
                <li>Reasoning agents (LLM, MCP, RL) receive the identical digest.</li>
                <li>Their batch of decisions is applied atomically.</li>
                <li>The fast loop resumes — no agent ever trades on stale prices.</li>
              </ol>
            </div>
          </div>
        </div>

        {lastTrace ? (
          <div className="stack" style={{ ["--gap" as string]: "6px" }}>
            <span className="label">Last macro decision</span>
            <p className="body" style={{ fontSize: 13 }}>
              <Badge tone="llm">{lastTrace.agentId}</Badge>{" "}
              <span className="caption">
                at tick <span className="num">{lastTrace.tick}</span>:
              </span>{" "}
              {lastTrace.thoughtSummary}{" "}
              <code className="code-inline">{lastTrace.toolAction}</code>
            </p>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
