"use client";

import { memo, useMemo, useState } from "react";
import { fmtSigned } from "../../lib/arena";
import { Pro, useDensity } from "../../lib/density";
import { cn } from "../../lib/utils";
import { ConceptPill, Panel, Segmented } from "../ui";
import { agentColor, regimeLabel } from "../arena/agentColors";
import { caption, dot, empty, label, mono12 } from "../ui/kit";
import { CopyButton, JsonView } from "./JsonView";
import { epochOf, toJsonRpc, type LoggedTrace } from "./model";

type Filter = "all" | "Gemini-2.5" | "DeepSeek-R1";

function Obs({ label: l, value, color, title }: { label: string; value: string; color?: string; title?: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-1" title={title}>
      <span className={cn(label, "text-[12px]")}>{l}</span>
      <span className={cn(mono12, "text-[13px] text-bone")} style={color ? { color } : undefined}>
        {value}
      </span>
    </span>
  );
}

/**
 * One trace: header, observation readouts, the thought, and the action. The
 * thought and action read as 12px mono on ink with a bone left rule (guide §5).
 */
const TraceCard = memo(function TraceCard({ log, pro }: { log: LoggedTrace; pro: boolean }) {
  const { trace, obs } = log;
  const rpc = useMemo(() => toJsonRpc(log), [log]);
  return (
    <article
      className="flex min-w-0 flex-col gap-3 border-b border-rule px-4 py-4 last:border-b-0"
      aria-label={`${trace.agentId} at tick ${trace.tick}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 font-sans text-[16px] leading-none font-[560] tracking-[-0.01em] text-bone [font-variation-settings:'wdth'_110]">
          <span className={dot} style={{ background: agentColor(trace.agentId) }} aria-hidden />
          {trace.agentId}
        </span>
        <span className={cn(mono12, "text-bone-3")}>
          tick {trace.tick.toLocaleString("en-US")} · epoch {epochOf(trace.tick)} · {regimeLabel(trace.regime).toLowerCase()}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
        <Obs label="Hawkes λ(t)" value={obs.lambda.toFixed(3)} color={obs.lambda > 1.5 ? "var(--ask)" : obs.lambda > 0.6 ? "var(--shock)" : undefined} />
        <Obs label="Book imbalance" value={fmtSigned(obs.imbalanceBps / 100, 1, "%")} color={obs.imbalanceBps >= 0 ? "var(--bid)" : "var(--ask)"} />
        <Obs label="Basis" value={fmtSigned(obs.basisBps, 0, " bps")} color={Math.abs(obs.basisBps) >= 34 ? "var(--pool)" : undefined} />
        <Obs label="Inventory skew" value={fmtSigned(obs.inventorySkewBps, 0, " bps")} title={`${obs.inventoryEth.toFixed(2)} ETH`} />
      </div>

      <div className="flex flex-col gap-2 border-l border-bone bg-ink py-1 pr-3 pl-3">
        <p className={cn(mono12, "text-bone text-pretty [font-variation-settings:'wdth'_87.5]")}>{trace.thoughtSummary}</p>
        <p className={cn(mono12, "break-words text-bone-2")}>
          → {rpc.label} · target spread {trace.targetSpreadBps} bps
        </p>
      </div>

      {pro ? (
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className={label}>JSON-RPC 2.0 request</span>
            <CopyButton value={rpc.payload} what="JSON-RPC request" />
          </div>
          <JsonView value={rpc.payload} compact label={`JSON-RPC request sent by ${trace.agentId}`} />
        </div>
      ) : null}
    </article>
  );
});

export function ReasoningTraces({ log }: { log: LoggedTrace[] }) {
  const [density] = useDensity();
  const pro = density === "pro";
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? log : log.filter((l) => l.trace.agentId === filter);
  const counts = useMemo(() => {
    const c = { "Gemini-2.5": 0, "DeepSeek-R1": 0 } as Record<string, number>;
    for (const l of log) c[l.trace.agentId] = (c[l.trace.agentId] ?? 0) + 1;
    return c;
  }, [log]);

  return (
    <Panel
      title="Reasoning traces"
      subtitle="What each LLM agent saw, what it concluded, and the tool call it sent"
      flush
      actions={
        <Segmented<Filter>
          ariaLabel="Filter traces by agent"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "Gemini-2.5", label: `Gemini ${counts["Gemini-2.5"]}` },
            { value: "DeepSeek-R1", label: `DeepSeek ${counts["DeepSeek-R1"]}` },
          ]}
        />
      }
      explain={{
        what: (
          <>
            A structured audit trail for the two LLM agents. The readouts are the market state the agent was looking at, the ruled block
            is its summarised reasoning and the tool it called on the ApexArena MCP server. Gemini-2.5 makes markets, so its decision becomes
            a batch of two post-only quotes; DeepSeek-R1 trades the cross-venue basis through the Revm pool.
          </>
        ),
        how: (
          <>
            Filter by agent, then compare λ(t), imbalance and basis against the chosen spread. In Pro, copy any JSON-RPC request and send it
            to <code>python -m apex_arena.mcp_server</code> to replay it against the real engine; the stdio server reads one request per
            line, so send the two elements of a batch separately.
          </>
        ),
        math: (
          <>
            Tool names and argument schemas match <code>sdks/python/apex_arena/mcp_server.py</code>. Quote prices are mid × (1 + skew) × (1 ±
            spread / 2). Inventory skew = inventory × mid / equity, in bps. The last 40 traces are kept on this page so they don&apos;t scroll
            away.
          </>
        ),
      }}
    >
      <Pro>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule px-4 py-2.5">
          <span className={caption}>Read the signals:</span>
          <ConceptPill concept="hawkes" label="λ(t)" />
          <ConceptPill concept="imbalance" label="Imbalance" />
          <ConceptPill concept="basis" label="Basis" />
          <ConceptPill concept="spread" label="Spread" />
        </div>
      </Pro>
      {shown.length === 0 ? (
        <div className={empty}>
          No traces yet. The LLM agents reason every 25 fast ticks; un-pause the arena and the first traces arrive within a quarter of an
          epoch.
        </div>
      ) : (
        <div className="max-h-[880px] overflow-y-auto" role="feed" aria-label="LLM reasoning traces, newest first">
          {shown.map((l) => (
            <TraceCard key={l.key} log={l} pro={pro} />
          ))}
        </div>
      )}
    </Panel>
  );
}
