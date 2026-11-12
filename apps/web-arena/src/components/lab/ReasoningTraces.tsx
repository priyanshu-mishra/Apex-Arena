"use client";

import { memo, useMemo, useState } from "react";
import { fmtSigned, regimeTone } from "../../lib/arena";
import { Badge, ConceptPill, Panel, Segmented } from "../ui";
import { CopyButton, JsonView } from "./JsonView";
import { epochOf, toJsonRpc, type LoggedTrace } from "./model";
import styles from "./Lab.module.css";

type Filter = "all" | "Gemini-2.5" | "DeepSeek-R1";

const TraceCard = memo(function TraceCard({ log, fresh }: { log: LoggedTrace; fresh: boolean }) {
  const { trace, obs } = log;
  const rpc = useMemo(() => toJsonRpc(log), [log]);
  return (
    <article className={`${styles.traceCard} ${fresh ? styles.traceCardFresh : ""}`} aria-label={`${trace.agentId} at tick ${trace.tick}`}>
      <header className={styles.traceHead}>
        <span className={styles.agentName}>
          <span className={styles.agentTag}>[LLM]</span>
          {trace.agentId}
        </span>
        <span className="row wrap" style={{ ["--gap" as string]: "8px" }}>
          <Badge tone={regimeTone(trace.regime)}>{trace.regime.toLowerCase()}</Badge>
          <span className="caption">
            tick <span className="num">{trace.tick.toLocaleString("en-US")}</span> · epoch{" "}
            <span className="num">{epochOf(trace.tick)}</span>
          </span>
        </span>
      </header>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Observation</span>
        <div className={styles.obsGrid}>
          <div className={styles.obs}>
            <span className={styles.obsLabel}>Hawkes λ(t)</span>
            <span className={styles.obsValue} style={{ color: obs.lambda > 1.5 ? "var(--ask)" : obs.lambda > 0.6 ? "var(--chaos)" : undefined }}>
              {obs.lambda.toFixed(3)}
            </span>
          </div>
          <div className={styles.obs}>
            <span className={styles.obsLabel}>Book imbalance</span>
            <span className={styles.obsValue} style={{ color: obs.imbalanceBps >= 0 ? "var(--bid)" : "var(--ask)" }}>
              {fmtSigned(obs.imbalanceBps / 100, 1, "%")}
            </span>
          </div>
          <div className={styles.obs}>
            <span className={styles.obsLabel}>Basis</span>
            <span className={styles.obsValue} style={{ color: Math.abs(obs.basisBps) >= 34 ? "var(--evm)" : undefined }}>
              {fmtSigned(obs.basisBps, 0, " bps")}
            </span>
          </div>
          <div className={styles.obs}>
            <span className={styles.obsLabel}>Inventory skew</span>
            <span className={styles.obsValue} title={`${obs.inventoryEth.toFixed(2)} ETH`}>
              {fmtSigned(obs.inventorySkewBps, 0, " bps")}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Thought</span>
        <p className={styles.thought}>
          {trace.thoughtSummary}{" "}
          <span className="caption">
            Target spread <span className="num">{trace.targetSpreadBps}</span> bps.
          </span>
        </p>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Action</span>
        <div className="stack" style={{ ["--gap" as string]: "6px", minWidth: 0 }}>
          <div className="row-between">
            <span className={styles.actionLabel}>
              JSON-RPC 2.0 · <span className="mono">{rpc.label}</span>
            </span>
            <CopyButton value={rpc.payload} what="JSON-RPC request" />
          </div>
          <JsonView value={rpc.payload} compact label={`JSON-RPC request sent by ${trace.agentId}`} />
        </div>
      </div>
    </article>
  );
});

export function ReasoningTraces({ log }: { log: LoggedTrace[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? log : log.filter((l) => l.trace.agentId === filter);
  const counts = useMemo(() => {
    const c = { "Gemini-2.5": 0, "DeepSeek-R1": 0 } as Record<string, number>;
    for (const l of log) c[l.trace.agentId] = (c[l.trace.agentId] ?? 0) + 1;
    return c;
  }, [log]);

  return (
    <Panel
      title="Reasoning inspector"
      subtitle="What each LLM agent saw, what it concluded, and the tool call it sent"
      actions={
        <Segmented<Filter>
          ariaLabel="Filter traces by agent"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "Gemini-2.5", label: `Gemini (${counts["Gemini-2.5"]})` },
            { value: "DeepSeek-R1", label: `DeepSeek (${counts["DeepSeek-R1"]})` },
          ]}
        />
      }
      explain={{
        what: (
          <>
            A structured audit trail for the two LLM agents. Observation is the market state the agent was looking at, Thought is its
            summarised reasoning, and Action is the JSON-RPC 2.0 request it sends to the ApexArena MCP server. Gemini-2.5 makes markets, so
            its decision becomes a batch of two post-only quotes; DeepSeek-R1 trades the cross-venue basis through the Revm pool.
          </>
        ),
        how: (
          <>
            Filter by agent, then compare λ(t), imbalance and basis against the chosen spread. Copy any request and send it to{" "}
            <span className="mono">python -m apex_arena.mcp_server</span> to replay it against the real engine; the stdio server reads one
            request per line, so send the two elements of a batch separately.
          </>
        ),
        math: (
          <>
            Tool names and argument schemas match <span className="mono">sdks/python/apex_arena/mcp_server.py</span>. Quote prices are
            mid × (1 + skew) × (1 ± spread / 2). Inventory skew = inventory × mid / equity, in bps. The last 40 traces are kept on this page so
            they don&apos;t scroll away.
          </>
        ),
      }}
    >
      <div className="stack" style={{ ["--gap" as string]: "12px" }}>
        <div className="row wrap" style={{ ["--gap" as string]: "6px" }}>
          <span className="caption">Read the signals:</span>
          <ConceptPill concept="hawkes" label="λ(t)" />
          <ConceptPill concept="imbalance" label="Imbalance" />
          <ConceptPill concept="basis" label="Basis" />
          <ConceptPill concept="spread" label="Spread" />
        </div>
        {shown.length === 0 ? (
          <div className="empty">
            No traces yet. The LLM agents reason every 25 fast ticks; un-pause the arena and the first cards arrive within a quarter of an
            epoch.
          </div>
        ) : (
          <div className={styles.timeline} role="feed" aria-label="LLM reasoning traces, newest first">
            {shown.map((l, i) => (
              <TraceCard key={l.key} log={l} fresh={i === 0} />
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
