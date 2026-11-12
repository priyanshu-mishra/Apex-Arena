"use client";

import { useState, type ReactNode } from "react";
import {
  USER_AGENT_ID,
  agentKind,
  bpsToUnit,
  displayAgentName,
  fmtSigned,
  fmtUsd,
  useArena,
} from "../../lib/arena";
import type { ConceptKey } from "../../lib/concepts";
import type { EvmTraceUi, LeaderboardEntryUi } from "../../lib/sharedBuffer";
import { Badge, ConceptPill, Meter, Panel, Tabs } from "../ui";
import { agentColor, regimeLabel } from "./agentColors";
import s from "./arena.module.css";

type SideTab = "board" | "evm" | "reasoning";

/* ---------------- Leaderboard ---------------- */
function Metric({ label, concept, children }: { label: string; concept?: ConceptKey; children: ReactNode }) {
  return (
    <div className={s.metric}>
      <span className={s.metricLabel}>
        {label}
        {concept ? <ConceptPill concept={concept} label="?" /> : null}
      </span>
      <span className={s.metricValue}>{children}</span>
    </div>
  );
}

function LeaderRow({ row, rank, open, onToggle }: { row: LeaderboardEntryUi; rank: number; open: boolean; onToggle: () => void }) {
  const kind = agentKind(row.badge);
  const liq = row.status === "LIQ";
  const you = row.agentId === USER_AGENT_ID;
  const acs = bpsToUnit(row.acsScoreBps);
  const detailId = `lb-${row.agentId.replace(/\W/g, "")}`;
  return (
    <div className={`${s.lbRow} ${liq ? s.lbLiq : you ? s.lbYou : ""}`}>
      <button type="button" className={s.lbButton} aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
        <span className={s.rank}>{rank}</span>
        <span className={s.lbMid}>
          <span className={s.lbName}>
            <span>{displayAgentName(row.agentId)}</span>
            <span className={s.swatchDot} style={{ background: agentColor(row.agentId) }} aria-hidden />
            <Badge tone={kind.tone}>{kind.label}</Badge>
            {liq ? <Badge tone="ask">Liquidated</Badge> : null}
          </span>
          <span className={s.lbStats}>
            <span className="num text-2">{fmtUsd(row.equityUsd, 0)}</span>
            <span className="num" style={{ color: row.pnlBps >= 0 ? "var(--bid)" : "var(--ask)" }}>
              {fmtSigned(row.pnlBps, 0)} bps
            </span>
            <span>{row.totalFills.toLocaleString("en-US")} fills</span>
          </span>
          <Meter value={acs} max={1} tone={liq ? "ask" : you ? "bid" : kind.tone} label={`ACS ${acs.toFixed(3)}`} />
        </span>
        <span className={s.lbRight}>
          <span className={s.acs} style={liq ? { color: "var(--ask)" } : undefined}>
            {acs.toFixed(3)}
          </span>
          <span className="caption">
            ACS <span className={s.chev} aria-hidden>›</span>
          </span>
        </span>
      </button>
      {open ? (
        <div className={s.lbDetail} id={detailId}>
          <Metric label="PSR(0)" concept="psr">{bpsToUnit(row.psrBps).toFixed(3)}</Metric>
          <Metric label="Calmar (capped)" concept="calmar">{bpsToUnit(row.calmarBps).toFixed(3)}</Metric>
          <Metric label="OOD survival" concept="ood">{bpsToUnit(row.oodSurvivalBps).toFixed(3)}</Metric>
          <Metric label="Max drawdown" concept="margin">{(row.maxDrawdownBps / 100).toFixed(2)}%</Metric>
          <Metric label="Inventory">{row.inventoryEth.toFixed(2)} ETH</Metric>
          <Metric label="Quoted spread">{row.activeSpreadBps} bps</Metric>
          <Metric label="Cash">{fmtUsd(row.cashUsd, 0)}</Metric>
          <Metric label="Status">{liq ? "Liquidated, ACS 0" : "Active"}</Metric>
        </div>
      ) : null}
    </div>
  );
}

function Leaderboard() {
  const { frame } = useArena();
  const [open, setOpen] = useState<string | null>(USER_AGENT_ID);
  const rows = [...frame.leaderboard].sort((a, b) => {
    if (a.status !== b.status) return a.status === "LIQ" ? 1 : -1;
    return b.acsScoreBps - a.acsScoreBps;
  });
  if (rows.length === 0) return <div className="empty">Agents are warming up. The ranking appears after the first scored tick.</div>;
  return (
    <div>
      <div className="row wrap" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", ["--gap" as string]: "6px" }}>
        <span className="caption">Ranked by</span>
        <ConceptPill concept="acs" label="Apex Composite Score" />
        <span className="caption">Expand a row for the components.</span>
      </div>
      {rows.map((r, i) => (
        <LeaderRow key={r.agentId} row={r} rank={i + 1} open={open === r.agentId} onToggle={() => setOpen((o) => (o === r.agentId ? null : r.agentId))} />
      ))}
    </div>
  );
}

/* ---------------- Revm stream ---------------- */
const ACTIONS: Record<string, { label: string; tone: string }> = {
  USER_SWAP_ETH_USDT: { label: "You sold ETH into the pool", tone: "var(--bid)" },
  USER_SWAP_USDT_ETH: { label: "You bought ETH from the pool", tone: "var(--bid)" },
  ATOMIC_ARB: { label: "Your atomic CLOB ↔ Revm arbitrage", tone: "var(--bid)" },
  SWAP_ETH_USDT: { label: "Swap ETH → USDT", tone: "var(--evm)" },
  CALL_SWAP_EXACT: { label: "swapExactTokens call", tone: "var(--evm)" },
  CONTRACT_DEPLOY: { label: "Pool contract deployed", tone: "var(--evm)" },
  ORACLE_UPDATE_LAG: { label: "Oracle lagging the CLOB", tone: "var(--chaos)" },
  ARB_SLIPPAGE: { label: "Arbitrage slippage", tone: "var(--chaos)" },
  TOXIC_FLOW_SANDWICH: { label: "Sandwich bundle (toxic flow)", tone: "var(--chaos)" },
  LIQUIDATION_WARNING: { label: "Liquidation warning", tone: "var(--ask)" },
};
function humanize(a: string) {
  const m = ACTIONS[a];
  if (m) return m;
  const l = a.toLowerCase().replace(/_/g, " ");
  return { label: l.charAt(0).toUpperCase() + l.slice(1), tone: "var(--evm)" };
}

function EventRow({ ev }: { ev: EvmTraceUi }) {
  const h = humanize(ev.action);
  return (
    <div className={s.event} style={{ ["--tone" as string]: h.tone }}>
      <div className={s.eventTop}>
        <span className={s.eventTitle}>{h.label}</span>
        <Badge tone={ev.slippageBps > 50 ? "ask" : ev.slippageBps > 10 ? "chaos" : undefined}>
          <span className="num">{ev.slippageBps}</span> bps slip
        </Badge>
      </div>
      <div className={s.eventMeta}>
        <span>
          Block <span className="num text-2">#{ev.blockNumber.toLocaleString("en-US")}</span>
        </span>
        <span>{displayAgentName(ev.caller)}</span>
        <span className="mono">{ev.txHash}</span>
      </div>
      <div className={s.eventLog}>{ev.logLine}</div>
    </div>
  );
}

function RevmStream() {
  const { frame } = useArena();
  return (
    <div>
      <div className={s.poolSummary}>
        <Metric label="ETH reserve (x)">{frame.evmReserveBaseEth.toLocaleString("en-US", { maximumFractionDigits: 2 })}</Metric>
        <Metric label="USDT reserve (y)">{frame.evmReserveQuoteUsdt.toLocaleString("en-US", { maximumFractionDigits: 0 })}</Metric>
        <Metric label="Invariant k" concept="invariantK">{frame.evmInvariantK}</Metric>
        <Metric label="Spot y ÷ x">{frame.evmSpotFormatted}</Metric>
      </div>
      {frame.evmEvents.length === 0 ? (
        <div className="empty">No on-chain activity yet. Swaps, oracle updates and arbitrage land here block by block.</div>
      ) : (
        <div className={s.feed} aria-live="off">
          {frame.evmEvents.map((ev) => (
            <EventRow key={ev.id} ev={ev} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Reasoning ---------------- */
function Reasoning() {
  const { frame } = useArena();
  return (
    <div>
      {frame.newsHeadline ? (
        <div className={s.headline}>
          <strong className="c-chaos">Macro wire</strong> {frame.newsHeadline.replace(/^\[[A-Z]+\]\s*/, "")}
        </div>
      ) : null}
      <div className="row wrap" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", ["--gap" as string]: "6px" }}>
        <span className="caption">Agents reason once per</span>
        <ConceptPill concept="macroDigest" label="macro epoch" />
        <span className="caption">and act through MCP tool calls.</span>
      </div>
      {frame.reasoningTraces.length === 0 ? (
        <div className="empty">No reasoning yet. LLM agents think at each 100-tick macro epoch; the first trace appears at the next barrier.</div>
      ) : (
        <div className={s.feed}>
          {frame.reasoningTraces.map((t, i) => (
            <article key={`${t.agentId}-${t.tick}-${i}`} className={s.trace}>
              <div className="row-between">
                <span className="row" style={{ ["--gap" as string]: "8px" }}>
                  <span className="dot" style={{ ["--accent" as string]: agentColor(t.agentId) }} aria-hidden />
                  <strong className="text-1" style={{ fontSize: 14 }}>
                    {displayAgentName(t.agentId)}
                  </strong>
                  <Badge tone="llm">LLM</Badge>
                </span>
                <span className="caption">
                  Tick <span className="num text-2">{t.tick.toLocaleString("en-US")}</span>
                </span>
              </div>
              <p className={s.traceThought}>{t.thoughtSummary}</p>
              <div className={s.traceTool}>{t.toolAction}</div>
              <div className="row wrap" style={{ ["--gap" as string]: "8px" }}>
                <Badge>{regimeLabel(t.regime)}</Badge>
                <span className="caption">
                  Target spread <span className="num text-2">{t.targetSpreadBps} bps</span>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Panel ---------------- */
const EXPLAIN: Record<SideTab, { what: ReactNode; how: ReactNode; math: ReactNode }> = {
  board: {
    what: "Every agent in the arena ranked by the Apex Composite Score, the benchmark's single number. LLM agents, quant agents, custom agents you deploy and your own desk are all scored the same way.",
    how: "Click a row to expand its score components. Liquidated agents drop to the bottom with ACS 0. The coloured dot matches the agent's line on the equity chart.",
    math: (
      <>
        <code>ACS = 0.40·PSR(0) + 0.30·Calmar_capped + 0.20·Survival_OOD − 0.10·Penalty_turnover</code>. Each component is stored as basis points (0 to 10,000) so the score itself is computed in integers.
      </>
    ),
  },
  evm: {
    what: "The block-by-block log of the embedded revm EVM: swaps against the constant-product pool, oracle updates, toxic-flow bundles, liquidation warnings and your own trades.",
    how: "Watch slippage badges to see how much each trade paid for moving the pool. Your own transactions are highlighted in green.",
    math: (
      <>
        Swaps follow <code>Δy = y·Δx·0.997 / (x + Δx·0.997)</code>. Slippage is the effective price&apos;s distance from the pre-trade spot <code>y / x</code>, in basis points.
      </>
    ),
  },
  reasoning: {
    what: "What the LLM agents were thinking at the last macro barriers, and the exact MCP tool call each one issued.",
    how: "Read the thought, then check the tool call: it is the only way an LLM agent can touch the market.",
    math: (
      <>
        Every 100 fast ticks the kernel freezes, compiles a deterministic <code>MacroDigest</code>, and hands it to reasoning agents. Their batch orders are applied before the clock resumes, so model latency never leaks into the simulation.
      </>
    ),
  },
};

export function SidePanel() {
  const { frame } = useArena();
  const [tab, setTab] = useState<SideTab>("board");
  const liq = frame.leaderboard.filter((r) => r.status === "LIQ").length;
  return (
    <Panel
      title={tab === "board" ? "Leaderboard" : tab === "evm" ? "Revm and fills stream" : "Agent reasoning"}
      subtitle={
        tab === "board"
          ? `${frame.leaderboard.length} agents${liq ? `, ${liq} liquidated` : ""}`
          : tab === "evm"
          ? `Block #${frame.blockNumber.toLocaleString("en-US")}`
          : `Regime: ${regimeLabel(frame.regime)}`
      }
      flush
      explain={EXPLAIN[tab]}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "board", label: "Leaderboard" },
          { id: "evm", label: "Revm and fills" },
          { id: "reasoning", label: "Agent reasoning" },
        ]}
      />
      <div role="tabpanel">
        {tab === "board" ? <Leaderboard /> : null}
        {tab === "evm" ? <RevmStream /> : null}
        {tab === "reasoning" ? <Reasoning /> : null}
      </div>
    </Panel>
  );
}
