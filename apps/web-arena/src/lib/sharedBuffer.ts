/**
 * SharedArrayBuffer Layout & Telemetry Types for ApexArena Web Spectator & Live Trading Suite.
 */

export type MarketRegimeLabel =
  | "CALM"
  | "TRENDING"
  | "LIQUIDITY DROUGHT"
  | "FLASH CRASH";

export const REGIME_CODE_TO_LABEL: Record<number, MarketRegimeLabel> = {
  0: "CALM",
  1: "TRENDING",
  2: "LIQUIDITY DROUGHT",
  3: "FLASH CRASH",
};

export const REGIME_LABEL_TO_CODE: Record<MarketRegimeLabel, number> = {
  CALM: 0,
  TRENDING: 1,
  "LIQUIDITY DROUGHT": 2,
  "FLASH CRASH": 3,
};

export const SAB_HEADER_SLOTS = 8;
export const SAB_RING_CAPACITY = 256;
export const SAB_STRIDE = 4;
export const SAB_TOTAL_FLOATS =
  SAB_HEADER_SLOTS + SAB_RING_CAPACITY * SAB_STRIDE;
export const SAB_BYTE_LENGTH = SAB_TOTAL_FLOATS * Float64Array.BYTES_PER_ELEMENT;

export interface L2LevelUi {
  pricePips: number;
  priceUsd: number;
  priceFormatted: string;
  qtyPips: number;
  qtyEth: number;
  qtyFormatted: string;
  cumulativeEth: number;
  orderCount: number;
}

export interface EvmTraceUi {
  id: string;
  blockNumber: number;
  txHash: string;
  caller: string;
  action: string;
  slippageBps: number;
  logLine: string;
}

export interface ReasoningTraceUi {
  tick: number;
  agentId: string;
  regime: MarketRegimeLabel;
  thoughtSummary: string;
  toolAction: string;
  targetSpreadBps: number;
}

export interface LeaderboardEntryUi {
  agentId: string;
  badge: "[AI]" | "[QT]" | "[YOU]" | "[CUST]";
  status: "ACT" | "LIQ";
  equityPips: number;
  equityUsd: number;
  equityFormatted: string;
  cashUsd: number;
  inventoryEth: number;
  pnlBps: number;
  maxDrawdownBps: number;
  psrBps: number;
  calmarBps: number;
  oodSurvivalBps: number;
  acsScoreBps: number;
  totalFills: number;
  activeSpreadBps: number;
}

export interface UserExecutionReceiptUi {
  id: string;
  tick: number;
  venue: "CLOB" | "REVM";
  side: "BID" | "ASK" | "SWAP";
  orderType: string;
  priceFormatted: string;
  qtyFormatted: string;
  status: string;
  detail: string;
}

export interface CustomAgentConfig {
  agentId: string;
  archetype: "NEURO_LLM_MM" | "CROSS_VENUE_ARB" | "HAWKES_MOMENTUM" | "OU_MEAN_REV";
  baseSpreadBps: number;
  oodSpreadMultiplier: number;
  maxDrawdownLimitBps: number;
  orderSizeEth: number;
}

export interface PricePointUi {
  tick: number;
  timeSec: number;
  clobMidUsd: number;
  evmSpotUsd: number;
  regime: MarketRegimeLabel;
  geminiEquityUsd: number;
  deepseekEquityUsd: number;
  hawkesEquityUsd: number;
  mmAlphaEquityUsd: number;
  userEquityUsd: number;
  /** Cross-venue basis (CLOB mid vs Revm spot) in bps at this tick. */
  basisBps?: number;
  /** Quoted CLOB spread in bps at this tick. */
  spreadBps?: number;
  /** Hawkes intensity λ(t) as a float (pips / SCALE). */
  hawkesIntensity?: number;
  /** Equity (USD) for every agent in the arena, keyed by agentId (includes custom agents). */
  agentEquities?: Record<string, number>;
}

export interface ArenaTelemetryFrame {
  tick: number;
  blockNumber: number;
  clobMidPips: number;
  clobMidUsd: number;
  clobMidFormatted: string;
  evmSpotPips: number;
  evmSpotUsd: number;
  evmSpotFormatted: string;
  basisBps: number;
  spreadBps: number;
  imbalanceBps: number;
  regime: MarketRegimeLabel;
  hawkesIntensityPips: number;
  newsHeadline: string;
  stateHash: string;
  evmReserveBaseEth: number;
  evmReserveQuoteUsdt: number;
  evmInvariantK: string;
  bids: L2LevelUi[];
  asks: L2LevelUi[];
  evmEvents: EvmTraceUi[];
  reasoningTraces: ReasoningTraceUi[];
  leaderboard: LeaderboardEntryUi[];
  userReceipts: UserExecutionReceiptUi[];
  latestPoint: PricePointUi;
  sharedBufferActive: boolean;
}

export function allocateTelemetryBuffer(): {
  buffer: SharedArrayBuffer | ArrayBuffer;
  isShared: boolean;
} {
  if (
    typeof SharedArrayBuffer !== "undefined" &&
    globalThis.crossOriginIsolated
  ) {
    return {
      buffer: new SharedArrayBuffer(SAB_BYTE_LENGTH),
      isShared: true,
    };
  }
  return {
    buffer: new ArrayBuffer(SAB_BYTE_LENGTH),
    isShared: false,
  };
}

export interface BenchmarkStageResult {
  key: string;
  name: string;
  endTick: number;
  regime: MarketRegimeLabel;
  clobMidUsd: number;
  evmSpotUsd: number;
  basisBps: number;
  hawkesIntensity: number;
  leaderboard: LeaderboardEntryUi[];
}

export interface BenchmarkAgentResult extends LeaderboardEntryUi {
  maxDrawdownPct: number;
  winRatePct: number;
  equityCurve: number[];
}

export interface BenchmarkResult {
  seed: number;
  ticksPerStage: number;
  totalTicks: number;
  stateHash: string;
  stages: BenchmarkStageResult[];
  agents: BenchmarkAgentResult[];
}

export interface BenchmarkProgress {
  stageIndex: number;
  stageCount: number;
  stageName: string;
  progress: number;
}
