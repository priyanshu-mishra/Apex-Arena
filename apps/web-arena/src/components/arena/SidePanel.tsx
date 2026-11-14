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
import { useDensity } from "../../lib/density";
import { cn } from "../../lib/utils";
import { Badge, ConceptPill, Meter, Panel, Tabs } from "../ui";
import { caption, dot, empty, label, mono12, num } from "../ui/kit";
import { agentColor, regimeLabel } from "./agentColors";

type SideTab = "board" | "evm" | "reasoning";

/* ---------------- Leaderboard ---------------- */
function Metric({ label: l, concept, children }: { label: string; concept?: ConceptKey; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={cn(label, "flex items-center gap-2")}>
        {l}
        {concept ? <ConceptPill concept={concept} label="?" /> : null}
      </span>
      <span className={cn(num, "text-[13px] text-bone")}>{children}</span>
    </div>
  );
}

/** One leaderboard row in the landing language: name + role, a mono line, a big Apex score. */
function LeaderRow({
  row,
  rank,
  open,
  onToggle,
  expandable,
}: {
  row: LeaderboardEntryUi;
  rank: number;
  open: boolean;
  onToggle: () => void;
  expandable: boolean;
}) {
  const kind = agentKind(row.badge);
  const liq = row.status === "LIQ";
  const you = row.agentId === USER_AGENT_ID;
  const acs = bpsToUnit(row.acsScoreBps);
  const detailId = `lb-${row.agentId.replace(/\W/g, "")}`;
  const inner = (
    <>
      <span className={cn(num, "w-5 shrink-0 self-start pt-[3px] text-[12px] text-bone-3")}>{rank}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span
          className={cn(
            "flex min-w-0 items-center gap-2 font-sans text-[16px] leading-none font-[560] tracking-[-0.01em] [font-variation-settings:'wdth'_110]",
            liq ? "text-bone-3 line-through decoration-1" : "text-bone",
          )}
        >
          <span className={dot} style={{ background: agentColor(row.agentId) }} aria-hidden />
          <span className="truncate">{displayAgentName(row.agentId)}</span>
        </span>
        <span className={cn("font-sans text-[12px] leading-none", liq ? "text-ask" : "text-bone-2")}>
          {liq ? "Liquidated at the 5% margin" : you ? "Your desk" : kind.label}
        </span>
        <span className={cn(mono12, "flex flex-wrap gap-x-3 text-bone-3")}>
          <span>{fmtUsd(row.equityUsd, 0)}</span>
          <span style={{ color: row.pnlBps >= 0 ? "var(--bid)" : "var(--ask)" }}>{fmtSigned(row.pnlBps, 0)} bps</span>
          <span>{row.totalFills.toLocaleString("en-US")} fills</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "font-mono text-[26px] leading-none font-medium tracking-[-0.03em] tabular-nums [font-variation-settings:'wdth'_80]",
            liq ? "text-ask" : "text-bone",
          )}
        >
          {acs.toFixed(3)}
        </span>
        <span className={cn(caption, "text-[12px]")}>Apex score{expandable ? (open ? " ▴" : " ▾") : ""}</span>
      </span>
    </>
  );
  return (
    <div className="border-b border-rule last:border-b-0" data-liquidated={liq || undefined}>
      {expandable ? (
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[rgba(237,234,227,0.03)]"
          aria-expanded={open}
          aria-controls={detailId}
          onClick={onToggle}
        >
          {inner}
        </button>
      ) : (
        <div className="flex w-full items-center gap-3 px-4 py-3.5">{inner}</div>
      )}
      {expandable && open ? (
        <div className="flex flex-col gap-3 px-4 pb-4 pl-12" id={detailId}>
          <Meter value={acs} max={1} tone={liq ? "ask" : undefined} label={`ACS ${acs.toFixed(3)}`} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Metric label="PSR(0)" concept="psr">{bpsToUnit(row.psrBps).toFixed(3)}</Metric>
            <Metric label="Calmar (capped)" concept="calmar">{bpsToUnit(row.calmarBps).toFixed(3)}</Metric>
            <Metric label="OOD survival" concept="ood">{bpsToUnit(row.oodSurvivalBps).toFixed(3)}</Metric>
            <Metric label="Max drawdown" concept="margin">{(row.maxDrawdownBps / 100).toFixed(2)}%</Metric>
            <Metric label="Inventory">{row.inventoryEth.toFixed(2)} ETH</Metric>
            <Metric label="Quoted spread">{row.activeSpreadBps} bps</Metric>
            <Metric label="Cash">{fmtUsd(row.cashUsd, 0)}</Metric>
            <Metric label="Status">{liq ? "Liquidated, ACS 0" : "Active"}</Metric>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Leaderboard({ expandable }: { expandable: boolean }) {
  const { frame } = useArena();
  const [open, setOpen] = useState<string | null>(USER_AGENT_ID);
  const rows = [...frame.leaderboard].sort((a, b) => {
    if (a.status !== b.status) return a.status === "LIQ" ? 1 : -1;
    return b.acsScoreBps - a.acsScoreBps;
  });
  if (rows.length === 0) return <div className={empty}>Agents are warming up. The ranking appears after the first scored tick.</div>;
  return (
    <div>
      {rows.map((r, i) => (
        <LeaderRow
          key={r.agentId}
          row={r}
          rank={i + 1}
          expandable={expandable}
          open={open === r.agentId}
          onToggle={() => setOpen((o) => (o === r.agentId ? null : r.agentId))}
        />
      ))}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-rule px-4 py-2.5">
        <span className={caption}>Ranked by the</span>
        <ConceptPill concept="acs" label="Apex Composite Score" />
        {expandable ? <span className={caption}>Expand a row for its parts.</span> : null}
      </div>
    </div>
  );
}

/* ---------------- Revm stream ---------------- */
const ACTIONS: Record<string, { label: string; tone: string }> = {
  USER_SWAP_ETH_USDT: { label: "You sold ETH into the pool", tone: "var(--bid)" },
  USER_SWAP_USDT_ETH: { label: "You bought ETH from the pool", tone: "var(--bid)" },
  ATOMIC_ARB: { label: "Your atomic CLOB ↔ Revm arbitrage", tone: "var(--bid)" },
  SWAP_ETH_USDT: { label: "Swap ETH → USDT", tone: "var(--pool)" },
  CALL_SWAP_EXACT: { label: "swapExactTokens call", tone: "var(--pool)" },
  CONTRACT_DEPLOY: { label: "Pool contract deployed", tone: "var(--pool)" },
  ORACLE_UPDATE_LAG: { label: "Oracle lagging the CLOB", tone: "var(--shock)" },
  ARB_SLIPPAGE: { label: "Arbitrage slippage", tone: "var(--shock)" },
  TOXIC_FLOW_SANDWICH: { label: "Sandwich bundle (toxic flow)", tone: "var(--shock)" },
  LIQUIDATION_WARNING: { label: "Liquidation warning", tone: "var(--ask)" },
};
function humanize(a: string) {
  const m = ACTIONS[a];
  if (m) return m;
  const l = a.toLowerCase().replace(/_/g, " ");
  return { label: l.charAt(0).toUpperCase() + l.slice(1), tone: "var(--pool)" };
}

function EventRow({ ev }: { ev: EvmTraceUi }) {
  const h = humanize(ev.action);
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-b border-rule px-4 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 font-sans text-[13.5px] font-semibold text-bone [font-variation-settings:'wdth'_108]">
          <span className={dot} style={{ background: h.tone }} aria-hidden />
          <span className="truncate">{h.label}</span>
        </span>
        <Badge tone={ev.slippageBps > 50 ? "ask" : ev.slippageBps > 10 ? "chaos" : undefined}>{ev.slippageBps} bps slip</Badge>
      </div>
      <div className={cn(mono12, "flex flex-wrap gap-x-3 text-bone-3")}>
        <span>block #{ev.blockNumber.toLocaleString("en-US")}</span>
        <span className="font-sans text-[12.5px]">{displayAgentName(ev.caller)}</span>
        <span className="max-w-full truncate">{ev.txHash}</span>
      </div>
      <div className={cn(mono12, "break-words text-bone-2")}>{ev.logLine}</div>
    </div>
  );
}

function RevmStream() {
  const { frame } = useArena();
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 border-b border-rule p-4">
        <Metric label="ETH reserve (x)">{frame.evmReserveBaseEth.toLocaleString("en-US", { maximumFractionDigits: 2 })}</Metric>
        <Metric label="USDT reserve (y)">{frame.evmReserveQuoteUsdt.toLocaleString("en-US", { maximumFractionDigits: 0 })}</Metric>
        <Metric label="Invariant k" concept="invariantK">{frame.evmInvariantK}</Metric>
        <Metric label="Spot y ÷ x">{frame.evmSpotFormatted}</Metric>
      </div>
      {frame.evmEvents.length === 0 ? (
        <div className={empty}>No on-chain activity yet. Swaps, oracle updates and arbitrage land here block by block.</div>
      ) : (
        <div className="max-h-[560px] overflow-y-auto" aria-live="off">
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
        <p className="border-b border-rule px-4 py-3 font-sans text-[13.5px] leading-[1.5] text-bone-2">
          <span className="mr-2 inline-flex items-center gap-1.5 font-semibold text-bone">
            <span className={dot} style={{ background: "var(--shock)" }} aria-hidden />
            Macro wire
          </span>
          {frame.newsHeadline.replace(/^\[[A-Z]+\]\s*/, "")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-rule px-4 py-2.5">
        <span className={caption}>Agents reason once per</span>
        <ConceptPill concept="macroDigest" label="macro epoch" />
        <span className={caption}>and act through MCP tool calls.</span>
      </div>
      {frame.reasoningTraces.length === 0 ? (
        <div className={empty}>No reasoning yet. LLM agents think at each 100-tick macro epoch; the first trace appears at the next barrier.</div>
      ) : (
        <div className="max-h-[560px] overflow-y-auto">
          {frame.reasoningTraces.map((t, i) => (
            <article key={`${t.agentId}-${t.tick}-${i}`} className="flex min-w-0 flex-col gap-2 border-b border-rule px-4 py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-sans text-[14px] font-semibold text-bone [font-variation-settings:'wdth'_108]">
                  <span className={dot} style={{ background: agentColor(t.agentId) }} aria-hidden />
                  {displayAgentName(t.agentId)}
                </span>
                <span className={cn(mono12, "text-bone-3")}>tick {t.tick.toLocaleString("en-US")}</span>
              </div>
              <p className="font-sans text-[13.5px] leading-[1.5] text-bone-2">{t.thoughtSummary}</p>
              <div className={cn(mono12, "border-l border-bone pl-3 break-words text-bone")}>{t.toolAction}</div>
              <div className={cn(mono12, "flex flex-wrap gap-x-3 text-bone-3")}>
                <span>{regimeLabel(t.regime).toLowerCase()}</span>
                <span>target spread {t.targetSpreadBps} bps</span>
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
    how: "Liquidated agents drop to the bottom with ACS 0, struck through. In Pro, click a row to expand its score components; the dot matches the agent's line on the equity chart.",
    math: (
      <>
        <code>ACS = 0.40·PSR(0) + 0.30·Calmar_capped + 0.20·Survival_OOD − 0.10·Penalty_turnover</code>. Each component is stored as basis points (0 to 10,000) so the score itself is computed in integers.
      </>
    ),
  },
  evm: {
    what: "The block-by-block log of the embedded revm EVM: swaps against the constant-product pool, oracle updates, toxic-flow bundles, liquidation warnings and your own trades.",
    how: "Watch slippage badges to see how much each trade paid for moving the pool. Your own transactions carry a mint dot.",
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
  const [density] = useDensity();
  const pro = density === "pro";
  const [tabChoice, setTab] = useState<SideTab>("board");
  // Simple shows the leaderboard only; Pro adds the Revm stream and agent reasoning.
  const tab: SideTab = pro ? tabChoice : "board";
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
      {pro ? (
        <Tabs
          ariaLabel="Side panel"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "board", label: "Leaderboard" },
            { id: "evm", label: "Revm and fills" },
            { id: "reasoning", label: "Agent reasoning" },
          ]}
        />
      ) : null}
      <div role={pro ? "tabpanel" : undefined}>
        {tab === "board" ? <Leaderboard expandable={pro} /> : null}
        {tab === "evm" ? <RevmStream /> : null}
        {tab === "reasoning" ? <Reasoning /> : null}
      </div>
    </Panel>
  );
}
