/** Typed client for POST /api/arena (see src/app/api/arena/route.ts). */

export const RUST_SCENARIOS = [
  { id: "calm", label: "Calm" },
  { id: "trending", label: "Trending" },
  { id: "drought", label: "Liquidity drought" },
  { id: "flash-crash", label: "Flash crash" },
] as const;
export type RustScenario = (typeof RUST_SCENARIOS)[number]["id"];

export const MCP_TOOL_EXAMPLES: Record<string, { args: Record<string, unknown>; blurb: string }> = {
  get_market_digest: {
    args: { advance_ticks: 100 },
    blurb: "Advance one macro epoch, then read the MacroDigest a reasoning agent would receive.",
  },
  get_orderbook_l2: { args: { depth: 5 }, blurb: "Top-of-book L2 ladder, spread and state hash." },
  submit_clob_order: {
    args: { agent_id: "web-verifier", side: "BID", order_type: "LIMIT", price: 2200.5, qty: 1.5 },
    blurb: "Send an order to the L3 CLOB. USD and ETH are converted to integer pips before reaching Rust.",
  },
  execute_evm_swap: {
    args: { agent_id: "web-verifier", zero_for_one: true, amount_in: 5 },
    blurb: "Swap 5 ETH for USDT through the revm constant-product pool.",
  },
  trigger_chaos_regime: { args: { regime: "flash-crash" }, blurb: "Force a regime change or an immediate flash crash." },
  get_leaderboard: { args: {}, blurb: "Equity, PnL, drawdown, PSR(0) and ACS for every agent." },
  verify_determinism: { args: { seed: 42, ticks: 200 }, blurb: "Run the 5-run SHA-256 check through the PyO3 binding." },
};
export const MCP_TOOL_NAMES = Object.keys(MCP_TOOL_EXAMPLES);

export interface ApiOk<T> {
  ok: true;
  data: T;
  ms: number;
}
export interface ApiErr {
  ok: false;
  error: string;
  hint?: string;
  ms: number;
  status?: number;
}
export type ApiResult<T> = ApiOk<T> | ApiErr;

export interface DeterminismResponse {
  ok: true;
  engine: string;
  command?: string;
  exitCode?: number | null;
  execMs?: number;
  elapsedMs?: number;
  seed: number;
  ticks: number;
  runs: number;
  all_equal: boolean;
  hashes: string[];
}

export interface RustLevel {
  price: number;
  total_qty: number;
  order_count: number;
}
export interface RustScore {
  agent_id: string;
  kind: string;
  status: string;
  initial_equity_pips: number;
  current_equity_pips: number;
  pnl_bps: number;
  max_drawdown_bps: number;
  psr_bps: number;
  calmar_capped_bps: number;
  ood_survival_bps: number;
  turnover_penalty_bps: number;
  acs_score_bps: number;
  total_fills: number;
}
export interface RustSnapshot {
  tick: number;
  virtual_ts_ns: number;
  block_number: number;
  regime: string;
  hawkes_intensity_pips: number;
  clob_mid_price: number;
  evm_spot_price: number;
  spread_bps: number;
  book: { bids: RustLevel[]; asks: RustLevel[]; best_bid: number | null; best_ask: number | null; mid_price: number; spread_bps: number };
  evm_reserve_base: number;
  evm_reserve_quote: number;
  recent_evm_events: { tx_hash: string; caller: string; action: string; slippage_bps: number; log_line: string }[];
  recent_reasoning: { tick: number; agent_id: string; thought_summary: string; tool_action: string }[];
  leaderboard: RustScore[];
  state_hash: string;
}
export interface SnapshotResponse {
  ok: true;
  engine: string;
  command?: string;
  scenario: string;
  seed: number;
  ticks: number;
  execMs?: number;
  snapshot: RustSnapshot;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: { content?: { type: string; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean; tools?: { name: string; description: string }[] };
  error?: { code: number; message: string };
}
export interface McpResponse {
  ok: true;
  engine: string;
  execMs?: number;
  request: unknown;
  response: JsonRpcResponse;
}

export const SCALE = 1e8;
export const pipsToUnit = (p: number) => p / SCALE;

export async function postArena<T>(body: Record<string, unknown>): Promise<ApiResult<T>> {
  if (process.env.NEXT_PUBLIC_STATIC_DEMO === "true") {
    return {
      ok: false,
      ms: 0,
      error: "Native Rust/Python verification is unavailable in the GitHub Pages demo.",
      hint: "Run the project locally with `cargo build -p apex-tui` and `cd apps/web-arena && bun run dev`. The browser simulation and browser determinism check work in this demo.",
    };
  }
  const t0 = performance.now();
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/arena`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const ms = Math.round(performance.now() - t0);
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        ok: false,
        ms,
        status: res.status,
        error: `The server answered ${res.status} ${res.statusText} with a non-JSON body.`,
        hint:
          res.status === 404
            ? "The /api/arena route is not available. Run the workstation with `bun run dev` (a static export has no server runtime)."
            : "Check the terminal running the Next.js server for a stack trace.",
      };
    }
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        ms,
        status: res.status,
        error: String(json.error ?? `Request failed with status ${res.status}.`),
        hint: typeof json.hint === "string" ? json.hint : undefined,
      };
    }
    return { ok: true, ms, data: json as T };
  } catch (err) {
    return {
      ok: false,
      ms: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.message : String(err),
      hint: "Could not reach the server. Make sure the Next.js server is running (`cd apps/web-arena && bun run dev`).",
    };
  }
}
