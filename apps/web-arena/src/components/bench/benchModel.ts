import type {
  BenchmarkAgentResult,
  BenchmarkResult,
  LeaderboardEntryUi,
  MarketRegimeLabel,
} from "../../lib/sharedBuffer";
import { agentKind } from "../../lib/arena";

export type Tone = "bid" | "ask" | "evm" | "chaos" | "llm";

/* ---------------------------------------------------------------------------
 * Stage catalogue — mirrors BENCH_STAGES in the worker (same keys, same order).
 * ------------------------------------------------------------------------- */
export interface StageMeta {
  key: string;
  name: string;
  stress: string;
  tone: Tone;
}

export const STAGE_META: StageMeta[] = [
  {
    key: "calm",
    name: "Calm baseline",
    stress: "Ordinary two-sided flow with no shock. Sets each agent's reference performance.",
    tone: "bid",
  },
  {
    key: "toxic",
    name: "MEV toxic flow",
    stress: "Informed one-sided takers and a sandwich bundle. Tests adverse-selection control.",
    tone: "chaos",
  },
  {
    key: "whale",
    name: "450 ETH AMM whale shock",
    stress: "A whale dumps 450 ETH into the Revm pool, opening a CLOB vs AMM basis.",
    tone: "evm",
  },
  {
    key: "crash",
    name: "350 bps flash cascade",
    stress: "Liquidity evaporates and Hawkes intensity spikes. Margin discipline decides survival.",
    tone: "ask",
  },
];

export const ACS_FORMULA =
  "ACS = 0.40·PSR(0) + 0.30·Calmar_capped + 0.20·Survival_OOD − 0.10·Penalty_turnover";
export const LIQUIDATION_RULE =
  "An account whose equity breaches the 5% maintenance margin is liquidated immediately and scores ACS = 0.";
export const HASH_LABEL = "256-bit state digest";
export const HASH_ALGORITHM_NOTE =
  "256-bit FNV-1a lane digest computed by the browser simulation kernel over seed, tick, regime, CLOB mid, AMM reserves and agent state. The native Rust kernel uses SHA-256 for the same purpose.";

/* ---------------------------------------------------------------------------
 * Grades
 * ------------------------------------------------------------------------- */
export type Grade = "S" | "A" | "B" | "C" | "F";

export const GRADE_SCALE: { grade: Grade; min: number; tone: Tone; meaning: string }[] = [
  { grade: "S", min: 0.8, tone: "llm", meaning: "ACS ≥ 0.80" },
  { grade: "A", min: 0.65, tone: "bid", meaning: "ACS ≥ 0.65" },
  { grade: "B", min: 0.5, tone: "evm", meaning: "ACS ≥ 0.50" },
  { grade: "C", min: 0.35, tone: "chaos", meaning: "ACS ≥ 0.35" },
  { grade: "F", min: 0, tone: "ask", meaning: "ACS < 0.35, or liquidated" },
];

export interface GradeInfo {
  grade: Grade;
  tone: Tone;
  liquidated: boolean;
  label: string;
  /** Sort rank: higher is better. */
  rank: number;
}

export function gradeFor(e: Pick<LeaderboardEntryUi, "status" | "acsScoreBps">): GradeInfo {
  if (e.status === "LIQ") {
    return { grade: "F", tone: "ask", liquidated: true, label: "F / Liquidated", rank: -1 };
  }
  const acs = e.acsScoreBps / 10000;
  const idx = GRADE_SCALE.findIndex((g) => acs >= g.min);
  const g = GRADE_SCALE[idx === -1 ? GRADE_SCALE.length - 1 : idx];
  return { grade: g.grade, tone: g.tone, liquidated: false, label: g.grade, rank: GRADE_SCALE.length - GRADE_SCALE.indexOf(g) };
}

/* ---------------------------------------------------------------------------
 * Formatting
 * ------------------------------------------------------------------------- */
export const unit = (bps: number, digits = 2) => (bps / 10000).toFixed(digits);

export function regimeText(r: MarketRegimeLabel): string {
  const s = r.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function regimeToneOf(r: MarketRegimeLabel): Tone {
  return r === "FLASH CRASH" ? "ask" : r === "LIQUIDITY DROUGHT" ? "chaos" : r === "TRENDING" ? "evm" : "bid";
}

export function shortHash(h: string, n = 12): string {
  return h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-6)}` : h;
}

export function stageAcs(result: BenchmarkResult, stageIdx: number, agentId: string): LeaderboardEntryUi | undefined {
  return result.stages[stageIdx]?.leaderboard.find((e) => e.agentId === agentId);
}

/* ---------------------------------------------------------------------------
 * JSON report
 * ------------------------------------------------------------------------- */
export function buildReport(result: BenchmarkResult, generatedAt: Date) {
  const ranked = rankAgents(result.agents);
  return {
    meta: {
      product: "ApexArena",
      report: "Standardized chaos benchmark suite",
      generatedAt: generatedAt.toISOString(),
      seed: result.seed,
      ticksPerStage: result.ticksPerStage,
      totalTicks: result.totalTicks,
      fastTickMs: 10,
      stateHash: {
        label: HASH_LABEL,
        value: result.stateHash,
        algorithm: HASH_ALGORITHM_NOTE,
      },
      formula: ACS_FORMULA,
      liquidationRule: LIQUIDATION_RULE,
      gradeScale: GRADE_SCALE.map((g) => ({ grade: g.grade, rule: g.meaning })),
      reproducibility:
        "Re-running with the same seed, ticks per stage and set of deployed agents reproduces the same state digest bit for bit.",
    },
    stages: result.stages.map((s, i) => {
      const meta = STAGE_META[i];
      const leader = s.leaderboard[0];
      return {
        index: i + 1,
        key: s.key,
        name: s.name,
        stresses: meta?.stress ?? null,
        endTick: s.endTick,
        endRegime: s.regime,
        clobMidUsd: s.clobMidUsd,
        revmSpotUsd: s.evmSpotUsd,
        basisBps: s.basisBps,
        hawkesIntensity: s.hawkesIntensity,
        leader: leader ? { agentId: leader.agentId, acs: leader.acsScoreBps / 10000 } : null,
        acsByAgent: Object.fromEntries(s.leaderboard.map((e) => [e.agentId, e.acsScoreBps / 10000])),
      };
    }),
    agents: ranked.map((a, i) => {
      const g = gradeFor(a);
      return {
        rank: i + 1,
        agentId: a.agentId,
        kind: agentKind(a.badge).label,
        status: a.status === "LIQ" ? "liquidated" : "active",
        grade: g.label,
        acs: a.acsScoreBps / 10000,
        psr0: a.psrBps / 10000,
        calmarCapped: a.calmarBps / 10000,
        oodSurvival: a.oodSurvivalBps / 10000,
        maxDrawdownPct: a.maxDrawdownPct,
        winRatePct: a.winRatePct,
        finalEquityUsd: a.equityUsd,
        pnlBps: a.pnlBps,
        totalFills: a.totalFills,
        equityCurveUsd: a.equityCurve,
      };
    }),
  };
}

export function rankAgents(agents: BenchmarkAgentResult[]): BenchmarkAgentResult[] {
  return agents
    .slice()
    .sort((a, b) => gradeFor(b).rank - gradeFor(a).rank || b.acsScoreBps - a.acsScoreBps || b.equityUsd - a.equityUsd);
}

export function downloadJson(result: BenchmarkResult) {
  const report = buildReport(result, new Date());
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `apexarena-benchmark-seed${result.seed}-${result.stateHash.slice(0, 8)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
