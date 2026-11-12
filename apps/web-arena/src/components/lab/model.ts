/**
 * Pure, deterministic helpers for the Agent lab view.
 *
 * The MacroDigest built here mirrors the field names the real Rust kernel
 * serializes (`crates/apex-types` `MacroDigest`, returned by the Python MCP
 * tool `get_market_digest` with `state_hash` appended): prices are integer
 * pips (SCALE = 10^8), the regime is the serde variant name. The nested
 * `clob` / `amm` / `basis_bps` blocks are web-workstation extensions so a
 * reader can see the full two-venue picture an agent reasons over.
 */

import type {
  ArenaTelemetryFrame,
  CustomAgentConfig,
  LeaderboardEntryUi,
  MarketRegimeLabel,
  PricePointUi,
  ReasoningTraceUi,
} from "../../lib/sharedBuffer";

export const SCALE = 100_000_000;
export const TICKS_PER_EPOCH = 100;
export const FAST_TICK_NS = 10_000_000;
export const FAST_TICK_MS = 10;

export const toPips = (v: number) => Math.round(v * SCALE);

/** serde variant names of `MarketRegime`. */
export const REGIME_VARIANT: Record<MarketRegimeLabel, string> = {
  CALM: "Calm",
  TRENDING: "Trending",
  "LIQUIDITY DROUGHT": "LiquidityDrought",
  "FLASH CRASH": "FlashCrash",
};

/** Same table as `ArenaKernel::compile_macro_digest` in crates/apex-kernel. */
export const REALIZED_VOL_BPS: Record<MarketRegimeLabel, number> = {
  CALM: 12,
  TRENDING: 28,
  "LIQUIDITY DROUGHT": 64,
  "FLASH CRASH": 145,
};

export const epochOf = (tick: number) => Math.floor(tick / TICKS_PER_EPOCH);

export interface MacroDigestJson {
  epoch_index: number;
  tick: number;
  virtual_ts_ns: number;
  block_number: number;
  regime: string;
  clob_mid_price: number;
  evm_spot_price: number;
  spread_bps: number;
  order_book_imbalance_bps: number;
  realized_vol_bps: number;
  hawkes_intensity_pips: number;
  news_headline: string;
  clob: {
    mid_price: number;
    best_bid: number | null;
    best_ask: number | null;
    spread_bps: number;
    imbalance_bps: number;
    top_bids: { price: number; qty: number; orders: number }[];
    top_asks: { price: number; qty: number; orders: number }[];
  };
  amm: {
    reserve_eth: number;
    reserve_usdt: number;
    spot_price: number;
    invariant_k: string;
    fee_bps: number;
  };
  basis_bps: number;
  state_hash: string;
}

export interface FrozenDigest {
  json: MacroDigestJson;
  source: "barrier" | "manual" | "initial";
  frozenAtTick: number;
}

export function buildDigest(frame: ArenaTelemetryFrame, source: FrozenDigest["source"]): FrozenDigest {
  const level = (l: { pricePips: number; qtyPips: number; orderCount: number }) => ({
    price: l.pricePips,
    qty: l.qtyPips,
    orders: l.orderCount,
  });
  const bestBid = frame.bids[0]?.pricePips ?? null;
  const bestAsk = frame.asks[0]?.pricePips ?? null;
  const json: MacroDigestJson = {
    epoch_index: epochOf(frame.tick),
    tick: frame.tick,
    virtual_ts_ns: frame.tick * FAST_TICK_NS,
    block_number: frame.blockNumber,
    regime: REGIME_VARIANT[frame.regime] ?? frame.regime,
    clob_mid_price: frame.clobMidPips,
    evm_spot_price: frame.evmSpotPips,
    spread_bps: frame.spreadBps,
    order_book_imbalance_bps: frame.imbalanceBps,
    realized_vol_bps: REALIZED_VOL_BPS[frame.regime] ?? 12,
    hawkes_intensity_pips: frame.hawkesIntensityPips,
    news_headline: frame.newsHeadline,
    clob: {
      mid_price: frame.clobMidPips,
      best_bid: bestBid,
      best_ask: bestAsk,
      spread_bps: frame.spreadBps,
      imbalance_bps: frame.imbalanceBps,
      top_bids: frame.bids.slice(0, 3).map(level),
      top_asks: frame.asks.slice(0, 3).map(level),
    },
    amm: {
      reserve_eth: toPips(frame.evmReserveBaseEth),
      reserve_usdt: toPips(frame.evmReserveQuoteUsdt),
      spot_price: frame.evmSpotPips,
      invariant_k: frame.evmInvariantK,
      fee_bps: 30,
    },
    basis_bps: frame.basisBps,
    state_hash: frame.stateHash,
  };
  return { json, source, frozenAtTick: frame.tick };
}

/* ---------------------------------------------------------------------------
 * JSON tokenizer — keys / strings / numbers / literals / punctuation.
 * ------------------------------------------------------------------------- */
export type JsonTokenKind = "key" | "string" | "number" | "literal" | "punct";
export interface JsonToken {
  kind: JsonTokenKind;
  text: string;
}

const TOKEN_RE =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])/g;

export function tokenizeJson(src: string): JsonToken[] {
  const out: JsonToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(src))) {
    if (m.index > last) out.push({ kind: "punct", text: src.slice(last, m.index) });
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        out.push({ kind: "key", text: m[1] });
        out.push({ kind: "punct", text: m[2] });
      } else out.push({ kind: "string", text: m[1] });
    } else if (m[3] !== undefined) out.push({ kind: "number", text: m[3] });
    else if (m[4] !== undefined) out.push({ kind: "literal", text: m[4] });
    else out.push({ kind: "punct", text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ kind: "punct", text: src.slice(last) });
  return out;
}

/* ---------------------------------------------------------------------------
 * Reasoning traces → observation snapshot + JSON-RPC 2.0 tools/call.
 * ------------------------------------------------------------------------- */
export const LLM_AGENTS = ["Gemini-2.5", "DeepSeek-R1"] as const;
export type LlmAgentId = (typeof LLM_AGENTS)[number];
export const isLlmAgent = (id: string): id is LlmAgentId => (LLM_AGENTS as readonly string[]).includes(id);

export interface TraceObservation {
  lambda: number;
  imbalanceBps: number;
  basisBps: number;
  midUsd: number;
  inventoryEth: number;
  inventorySkewBps: number;
  equityUsd: number;
}

export interface LoggedTrace {
  key: string;
  trace: ReasoningTraceUi;
  obs: TraceObservation;
}

export function observe(
  trace: ReasoningTraceUi,
  frame: ArenaTelemetryFrame,
  history: PricePointUi[]
): TraceObservation {
  // Prefer the history point at the trace's own tick; fall back to the live frame.
  let pt: PricePointUi | undefined;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].tick <= trace.tick) {
      pt = history[i];
      break;
    }
  }
  const lambda = pt?.hawkesIntensity ?? frame.hawkesIntensityPips / SCALE;
  const basisBps = pt?.basisBps ?? frame.basisBps;
  const midUsd = pt?.clobMidUsd ?? frame.clobMidUsd;
  const lb = frame.leaderboard.find((e) => e.agentId === trace.agentId);
  const inventoryEth = lb?.inventoryEth ?? 0;
  const equityUsd = lb?.equityUsd ?? 0;
  const inventorySkewBps = equityUsd > 0 ? Math.round(((inventoryEth * midUsd) / equityUsd) * 10000) : 0;
  return { lambda, imbalanceBps: frame.imbalanceBps, basisBps, midUsd, inventoryEth, inventorySkewBps, equityUsd };
}

const num = (s: string, re: RegExp, d: number) => {
  const m = s.match(re);
  return m ? Number(m[1]) : d;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Translate the sim's tool shorthand into the request an MCP client would
 * actually send to `ApexMcpServer.handle_jsonrpc`. Tool names and argument
 * schemas match `sdks/python/apex_arena/mcp_server.py` exactly.
 */
export function toJsonRpc(log: LoggedTrace): { label: string; payload: unknown } {
  const { trace, obs } = log;
  const a = trace.toolAction;
  const idBase = `${trace.agentId.toLowerCase()}:t${trace.tick}`;

  if (/execute_evm_swap/.test(a)) {
    const zeroForOne = /zero_for_one\s*=\s*true/i.test(a);
    const amount = num(a, /amount(?:_in)?\s*=\s*([\d.]+)/, 2.4);
    return {
      label: "tools/call · execute_evm_swap",
      payload: {
        jsonrpc: "2.0",
        id: `${idBase}:swap`,
        method: "tools/call",
        params: {
          name: "execute_evm_swap",
          arguments: { agent_id: trace.agentId, zero_for_one: zeroForOne, amount_in: amount },
        },
      },
    };
  }

  // set_mm_params(spread, skew) → a JSON-RPC 2.0 batch of two POST_ONLY quotes.
  const spread = num(a, /spread_bps\s*=\s*(-?[\d.]+)/, trace.targetSpreadBps);
  const skew = num(a, /skew_bps\s*=\s*(-?[\d.]+)/, 0);
  const mid = obs.midUsd;
  const half = spread / 2 / 10000;
  const center = mid * (1 + skew / 10000);
  const bid = round2(center * (1 - half));
  const ask = round2(center * (1 + half));
  const call = (side: "BID" | "ASK", price: number) => ({
    jsonrpc: "2.0",
    id: `${idBase}:${side.toLowerCase()}`,
    method: "tools/call",
    params: {
      name: "submit_clob_order",
      arguments: { agent_id: trace.agentId, side, order_type: "POST_ONLY", price, qty: 2.5 },
    },
  });
  return {
    label: "batch · 2 × submit_clob_order",
    payload: [call("BID", bid), call("ASK", ask)],
  };
}

/* ---------------------------------------------------------------------------
 * Custom agent builder — strategy preview math.
 * ------------------------------------------------------------------------- */
export type Archetype = CustomAgentConfig["archetype"];

export const ARCHETYPES: { id: Archetype; label: string; description: string }[] = [
  {
    id: "NEURO_LLM_MM",
    label: "LLM market maker",
    description: "Quotes both sides of the CLOB and re-tunes spread and skew at every macro epoch.",
  },
  {
    id: "CROSS_VENUE_ARB",
    label: "Cross-venue arbitrageur",
    description: "Buys on the cheaper venue and sells on the richer one when basis beats the ~34 bps round-trip fee.",
  },
  {
    id: "HAWKES_MOMENTUM",
    label: "Hawkes momentum",
    description: "Leans with the move when λ(t) is excited, betting that shocks cluster and keep going.",
  },
  {
    id: "OU_MEAN_REV",
    label: "OU mean reversion",
    description: "Fades deviations from a fair value that is pulled back by an Ornstein-Uhlenbeck process.",
  },
];

/** Starting inventory the worker assigns on deploy (see deployCustomAgent). */
export const startInventoryEth = (a: Archetype) => (a === "NEURO_LLM_MM" ? -25 : 15);

export interface BuilderParams {
  name: string;
  archetype: Archetype;
  gamma: number;
  baseSpreadBps: number;
  inventoryTargetEth: number;
  oodLambdaThreshold: number;
  oodSpreadMultiplier: number;
  arbAggressivenessPct: number;
  maxDrawdownLimitBps: number;
  orderSizeEth: number;
}

export interface StrategyPreview {
  mid: number;
  sigmaUsd: number;
  q: number;
  reservation: number;
  reservationOffsetBps: number;
  skewCapped: boolean;
  defensive: boolean;
  spreadBps: number;
  bid: number;
  ask: number;
  arbTriggerBps: number;
  arbLive: boolean;
}

export function previewStrategy(p: BuilderParams, frame: ArenaTelemetryFrame): StrategyPreview {
  const mid = frame.clobMidUsd;
  const lambda = frame.hawkesIntensityPips / SCALE;
  const volBps = REALIZED_VOL_BPS[frame.regime] ?? 12;
  // Per-epoch realized vol scaled to one 10 ms fast tick (√100 ticks per epoch).
  const sigmaUsd = (mid * volBps) / 10000 / Math.sqrt(TICKS_PER_EPOCH);
  const q = startInventoryEth(p.archetype) - p.inventoryTargetEth;
  const defensive = lambda >= p.oodLambdaThreshold;
  const spreadBps = p.baseSpreadBps * (defensive ? p.oodSpreadMultiplier : 1);
  const halfUsd = (mid * spreadBps) / 2 / 10000;
  const rawOffset = q * p.gamma * sigmaUsd * sigmaUsd;
  const cap = 2 * halfUsd;
  const offset = Math.max(-cap, Math.min(cap, rawOffset));
  const reservation = mid - offset;
  const arbTriggerBps = Math.round(34 + (1 - p.arbAggressivenessPct / 100) * 40);
  return {
    mid,
    sigmaUsd,
    q,
    reservation,
    reservationOffsetBps: mid > 0 ? (-offset / mid) * 10000 : 0,
    skewCapped: Math.abs(rawOffset) > cap,
    defensive,
    spreadBps,
    bid: reservation - halfUsd,
    ask: reservation + halfUsd,
    arbTriggerBps,
    arbLive: Math.abs(frame.basisBps) >= arbTriggerBps,
  };
}

export function validateName(name: string, leaderboard: LeaderboardEntryUi[]): string | null {
  const n = name.trim();
  if (!n) return "Give the agent a name.";
  if (n.length > 32) return "Keep the name to 32 characters or fewer.";
  if (!/^[\w .()-]+$/.test(n)) return "Use letters, numbers, spaces, dots, dashes or underscores.";
  if (leaderboard.some((e) => e.agentId.toLowerCase() === n.toLowerCase()))
    return `An agent named "${n}" is already on the leaderboard. Pick a different name.`;
  return null;
}

/* ---------------------------------------------------------------------------
 * Head-to-head helpers.
 * ------------------------------------------------------------------------- */
const LEGACY_EQUITY: Record<string, keyof PricePointUi> = {
  "Gemini-2.5": "geminiEquityUsd",
  "DeepSeek-R1": "deepseekEquityUsd",
  "Hawkes-HFT": "hawkesEquityUsd",
  "MM-Alpha": "mmAlphaEquityUsd",
  "You (Live Desk)": "userEquityUsd",
};

export function equitySeries(history: PricePointUi[], agentId: string): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = [];
  const legacy = LEGACY_EQUITY[agentId];
  for (const p of history) {
    let v = p.agentEquities?.[agentId];
    if (v === undefined && legacy) v = p[legacy] as number | undefined;
    if (typeof v === "number" && Number.isFinite(v)) out.push({ t: p.timeSec, v });
  }
  return out;
}
