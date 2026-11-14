"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useArena } from "../../lib/arena";
import { Pro } from "../../lib/density";
import { ConceptPill } from "../ui";
import { page } from "../ui/kit";
import { PageHead } from "./PageHead";
import { AgentBuilder } from "../lab/AgentBuilder";
import { BarrierInspector } from "../lab/BarrierInspector";
import { DigestPanel } from "../lab/DigestPanel";
import { HeadToHead } from "../lab/HeadToHead";
import { ReasoningTraces } from "../lab/ReasoningTraces";
import { buildDigest, epochOf, isLlmAgent, observe, type FrozenDigest, type LoggedTrace } from "../lab/model";

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
    <div className={page}>
      <PageHead
        title="Agents"
        lede={
          <>
            Look inside the reasoning agents: what they saw, what they concluded and the tool call they sent. Then build your own agent
            and race it against them. Pro adds the one-second <ConceptPill concept="macroDigest" /> they receive and a head-to-head.
          </>
        }
      />

      <Pro>
        <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-2">
          <DigestPanel digest={digest} onFreeze={freezeNow} />
          <BarrierInspector digest={digest} />
        </div>
      </Pro>

      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ReasoningTraces log={log} />
        <AgentBuilder />
      </div>

      <Pro>
        <HeadToHead />
      </Pro>
    </div>
  );
}
