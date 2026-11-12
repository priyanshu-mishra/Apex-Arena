"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useArena } from "../../lib/arena";
import { ConceptPill } from "../ui";
import { AgentBuilder } from "../lab/AgentBuilder";
import { BarrierInspector } from "../lab/BarrierInspector";
import { DigestPanel } from "../lab/DigestPanel";
import { HeadToHead } from "../lab/HeadToHead";
import { ReasoningTraces } from "../lab/ReasoningTraces";
import { buildDigest, epochOf, isLlmAgent, observe, type FrozenDigest, type LoggedTrace } from "../lab/model";
import styles from "../lab/Lab.module.css";

const TRACE_CAP = 40;

export function AgentLabView() {
  const { frame, history, actions } = useArena();

  /* ---- MacroDigest: frozen at every epoch boundary, or on demand ---- */
  const [digest, setDigest] = useState<FrozenDigest | null>(null);
  const lastEpoch = useRef<number | null>(null);
  const lastTick = useRef<number>(-1);

  /* ---- Rolling reasoning-trace log (dedupe by tick + agent) ---- */
  const [log, setLog] = useState<LoggedTrace[]>([]);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    // A reset sends the tick backwards: start the lab's local state over.
    if (frame.tick < lastTick.current) {
      seen.current = new Set();
      setLog([]);
      lastEpoch.current = null;
    }
    lastTick.current = frame.tick;

    const ep = epochOf(frame.tick);
    if (lastEpoch.current === null) {
      lastEpoch.current = ep;
      setDigest(buildDigest(frame, "initial"));
    } else if (ep !== lastEpoch.current) {
      lastEpoch.current = ep;
      setDigest(buildDigest(frame, "barrier"));
    }

    const fresh: LoggedTrace[] = [];
    for (const t of frame.reasoningTraces) {
      if (!isLlmAgent(t.agentId)) continue;
      const key = `${t.tick}:${t.agentId}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      fresh.push({ key, trace: t, obs: observe(t, frame, history) });
    }
    if (fresh.length) {
      setLog((prev) => {
        const next = [...fresh, ...prev].sort((x, y) => y.trace.tick - x.trace.tick || x.trace.agentId.localeCompare(y.trace.agentId));
        const capped = next.slice(0, TRACE_CAP);
        if (next.length > TRACE_CAP) {
          seen.current = new Set(capped.map((l) => l.key));
        }
        return capped;
      });
    }
    // history is read for context only; frame drives the updates.
  }, [frame]);

  const freezeNow = useCallback(() => {
    setDigest(buildDigest(frame, "manual"));
    actions.toast({
      title: `Digest frozen at tick ${frame.tick.toLocaleString("en-US")}`,
      body: "Snapshot taken between barriers. It is replaced at the next epoch boundary.",
      tone: "evm",
    });
  }, [frame, actions]);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <div className="stack" style={{ ["--gap" as string]: "8px" }}>
          <h1 className="h2">Agent lab</h1>
          <p className="lead">
            Look inside the reasoning agents. See the one-second <ConceptPill concept="macroDigest" /> they receive, the decision each one
            makes, and the exact MCP tool call it sends. Then build your own agent and race it against them.
          </p>
        </div>
      </header>

      <div className={styles.workspace}>
        <div className={styles.column}>
          <BarrierInspector digest={digest} />
          <DigestPanel digest={digest} onFreeze={freezeNow} />
        </div>
        <div className={styles.column}>
          <ReasoningTraces log={log} />
        </div>
      </div>

      <AgentBuilder />
      <HeadToHead />
    </div>
  );
}
