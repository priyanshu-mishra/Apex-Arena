import type { ArenaTelemetryFrame } from "./sharedBuffer";

export interface Narrative {
  tone: "bid" | "ask" | "evm" | "chaos" | "llm";
  headline: string;
  detail: string;
}

const usd = (n: number) =>
  "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Translates raw telemetry into one plain-English sentence about what the market is doing.
 * Priority: liquidations > fresh on-chain shocks > regime-specific commentary.
 */
export function buildNarrative(f: ArenaTelemetryFrame): Narrative {
  const liquidated = f.leaderboard.filter((e) => e.status === "LIQ");
  const lambda = f.hawkesIntensityPips / 1e8;
  const gap = f.clobMidUsd - f.evmSpotUsd;
  const latestEvm = f.evmEvents[0];
  const recentEvm = latestEvm && f.blockNumber - latestEvm.blockNumber <= 6 ? latestEvm : null;
  const leader = f.leaderboard[0];

  if (recentEvm && recentEvm.action === "WHALE_DUMP_450_ETH") {
    return {
      tone: "evm",
      headline: "Whale dump hit the Revm pool",
      detail: `A 450 ETH swap pushed on-chain spot ${usd(gap)} ${gap >= 0 ? "below" : "above"} the CLOB mid (${f.basisBps} bps). Arbitrageurs are buying cheap AMM ETH and selling into CLOB bids.`,
    };
  }

  if (liquidated.length > 0 && f.regime === "FLASH CRASH") {
    const names = liquidated.map((l) => l.agentId).join(", ");
    return {
      tone: "ask",
      headline: "Margin breach",
      detail: `${names} fell through the 5% maintenance margin during the flash crash and ${liquidated.length > 1 ? "were" : "was"} force-liquidated (ACS = 0.000). λ(t) is ${lambda.toFixed(2)}.`,
    };
  }

  if (recentEvm && recentEvm.action === "TOXIC_FLOW_SANDWICH") {
    return {
      tone: "chaos",
      headline: "Toxic flow detected",
      detail: `An MEV sandwich front-ran the pool; informed sellers dominate the book (imbalance ${(f.imbalanceBps / 100).toFixed(1)}%). Makers are widening to ${f.spreadBps} bps to avoid adverse selection.`,
    };
  }

  if (recentEvm && recentEvm.action === "ATOMIC_ARB") {
    return {
      tone: "evm",
      headline: "Your arbitrage landed",
      detail: `Atomic CLOB ↔ Revm round-trip settled in block #${recentEvm.blockNumber}; basis is now ${f.basisBps} bps.`,
    };
  }

  switch (f.regime) {
    case "FLASH CRASH":
      return {
        tone: "ask",
        headline: "Flash crash in progress",
        detail: `Liquidity is evaporating: spread ${f.spreadBps} bps, Hawkes λ(t) ${lambda.toFixed(2)} and climbing. LLM agents are widening quotes and hedging inventory${leader ? `; ${leader.agentId} still leads on ACS` : ""}.`,
      };
    case "LIQUIDITY DROUGHT":
      return {
        tone: "chaos",
        headline: "Liquidity drought",
        detail: `Depth is thinning and λ(t) sits at ${lambda.toFixed(2)}. Spread has widened to ${f.spreadBps} bps; cross-venue basis is ${f.basisBps} bps${Math.abs(f.basisBps) > 34 ? " — wide enough to arbitrage after fees" : ""}.`,
      };
    case "TRENDING":
      return {
        tone: "evm",
        headline: "Trending market",
        detail: `Directional flow is moving both venues; CLOB mid ${f.clobMidFormatted} vs Revm ${f.evmSpotFormatted} (${f.basisBps} bps basis). Momentum agents are leaning with the trend.`,
      };
    default:
      return {
        tone: "bid",
        headline: "Calm regime",
        detail: `Tight ${f.spreadBps} bps spread. Market makers are quoting balanced two-sided liquidity and the CLOB ↔ Revm basis is near equilibrium (${f.basisBps} bps).${leader ? ` ${leader.agentId} leads the ACS table.` : ""}`,
      };
  }
}
