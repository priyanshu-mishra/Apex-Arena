/**
 * Static description of the ApexArena system, used by the architecture diagram
 * and its detail panel. Every path, type and function named here exists in the
 * repository.
 */

export type Tone = "bid" | "ask" | "evm" | "chaos" | "llm" | "neutral";
export type Layer = "web" | "bridge" | "core";
export type FlowMode = "all" | "fast" | "macro" | "proof";

export interface ArchNode {
  id: string;
  label: string;
  sub: string;
  layer: Layer;
  tone: Tone;
  /** SVG geometry in the 1100×640 viewBox. */
  x: number;
  y: number;
  w: number;
  h: number;
  what: string;
  invariants: string[];
  files: string[];
  symbols: string[];
  flows: FlowMode[];
}

export interface ArchEdge {
  from: string;
  to: string;
  label?: string;
  /** Optional explicit SVG path; otherwise a straight/elbow path is derived. */
  d?: string;
  dashed?: boolean;
  lx?: number;
  ly?: number;
  anchor?: "start" | "middle" | "end";
  flows: FlowMode[];
  tone?: Tone;
}

export const LAYERS: { id: Layer; label: string; caption: string; y: number; h: number }[] = [
  { id: "web", label: "Web workstation", caption: "Next.js 15 · React 19 · WebWorker", y: 16, h: 148 },
  { id: "bridge", label: "Bridges", caption: "CLI · PyO3 · MCP JSON-RPC 2.0", y: 188, h: 196 },
  { id: "core", label: "Rust core", caption: "Deterministic, fixed-point, single-threaded", y: 408, h: 170 },
];

export const NODES: ArchNode[] = [
  // ---------------- Web ----------------
  {
    id: "views",
    label: "React views",
    sub: "Five workstation views",
    layer: "web",
    tone: "neutral",
    x: 40, y: 64, w: 200, h: 64,
    what:
      "The five workstation views. They render at display rate from the latest telemetry frame published by ArenaProvider and send every user command (orders, swaps, scenario injections, agent deploys) back to the worker as a typed message.",
    invariants: [
      "Never mutate simulation state directly — only post WorkerCommand messages.",
      "Chart series receive strictly ascending, de-duplicated timeSec values (lightweight-charts v5 asserts on duplicates).",
    ],
    files: ["apps/web-arena/src/lib/arena.tsx", "apps/web-arena/src/components/views/"],
    symbols: ["ArenaProvider", "useArena()", "mergeHistory()", "sanitizeHistory()"],
    flows: ["all", "fast", "macro"],
  },
  {
    id: "sab",
    label: "SharedArrayBuffer",
    sub: "Zero-copy telemetry",
    layer: "web",
    tone: "neutral",
    x: 290, y: 64, w: 200, h: 64,
    what:
      "A zero-copy telemetry channel between the worker and the main thread. When the page is cross-origin isolated it is a real SharedArrayBuffer; otherwise it falls back to an ArrayBuffer and full frames travel by postMessage.",
    invariants: [
      "Fixed layout: 8 header slots + 256 × 4 Float64 ring entries.",
      "Frames are coalesced to one React render per animation frame.",
    ],
    files: ["apps/web-arena/src/lib/sharedBuffer.ts"],
    symbols: ["allocateTelemetryBuffer()", "SAB_RING_CAPACITY = 256", "SAB_STRIDE = 4", "ArenaTelemetryFrame"],
    flows: ["all", "fast"],
  },
  {
    id: "worker",
    label: "WebWorker simulation",
    sub: "In-browser kernel port",
    layer: "web",
    tone: "chaos",
    x: 540, y: 64, w: 220, h: 64,
    what:
      "A seeded JavaScript port of the arena that runs off the main thread: CLOB, constant-product pool, Hawkes chaos, ABIDES-style background agents, the [YOU] trading desk, custom agents and the chaos benchmark. It can run its own 5-run hash check.",
    invariants: [
      "Seeded PRNG only; ticks advance monotonically so charts never see a repeated timestamp.",
      "Owns all mutable simulation state; the UI is a pure projection of its frames.",
    ],
    files: ["apps/web-arena/src/workers/arena.worker.ts"],
    symbols: ["DeterministicKernel", "VERIFY_5RUN_SHA256", "RUN_BENCHMARK", "CAPTURE_ARB"],
    flows: ["all", "fast", "macro", "proof"],
  },
  {
    id: "api",
    label: "Next.js API route",
    sub: "POST /api/arena",
    layer: "web",
    tone: "evm",
    x: 820, y: 64, w: 240, h: 64,
    what:
      "The server-side bridge from the browser to native code. It validates every input against an allow-list, clamps seed and ticks, then spawns the compiled Rust binary or a Python process hosting the MCP server and returns their JSON verbatim.",
    invariants: [
      "Only four actions: verify_rust_determinism, rust_snapshot, mcp_call, tools_list.",
      "Scenario and MCP tool names are allow-listed; ticks are clamped to 1–20,000.",
      "Child processes are time-boxed (20 s) and never receive shell-interpolated input.",
    ],
    files: ["apps/web-arena/src/app/api/arena/route.ts"],
    symbols: ["POST()", "execFile()", "MCP_TOOLS", "RUST_SCENARIOS"],
    flows: ["all", "proof"],
  },
  // ---------------- Bridges ----------------
  {
    id: "tui",
    label: "apex-tui CLI",
    sub: "Native CLI + JSON mode",
    layer: "bridge",
    tone: "neutral",
    x: 540, y: 236, w: 220, h: 64,
    what:
      "The native entry point. Interactively it is a four-quadrant Ratatui terminal; headless it prints a TickTelemetry snapshot as JSON or runs five independent kernels and prints all five SHA-256 state hashes.",
    invariants: [
      "--verify-determinism exits with code 1 if any of the five hashes differ.",
      "Verification injects a flash crash at ticks / 2 so the hash covers a regime shock.",
    ],
    files: ["crates/apex-tui/src/main.rs", "crates/apex-tui/src/ui.rs"],
    symbols: ["--seed", "--ticks", "--scenario", "--json", "--verify-determinism", "render_workstation_frame()"],
    flows: ["all", "proof"],
  },
  {
    id: "mcp",
    label: "MCP server",
    sub: "JSON-RPC 2.0 · 7 tools",
    layer: "bridge",
    tone: "llm",
    x: 820, y: 220, w: 240, h: 64,
    what:
      "A Model Context Protocol server that lets any tool-calling LLM read the market and act on it: get_market_digest, get_orderbook_l2, submit_clob_order, execute_evm_swap, trigger_chaos_regime, get_leaderboard and verify_determinism. Runs over stdio or in-memory.",
    invariants: [
      "Speaks protocolVersion 2024-11-05; errors use JSON-RPC codes −32601 / −32602.",
      "USD and ETH inputs are converted to integer pips (×10⁸) before reaching Rust.",
    ],
    files: ["sdks/python/apex_arena/mcp_server.py", "sdks/python/apex_arena/engine.py"],
    symbols: ["ApexMcpServer", "handle_jsonrpc()", "list_tools()", "call_tool()", "to_pips()"],
    flows: ["all", "macro", "proof"],
  },
  {
    id: "py",
    label: "apex-py PyO3 _core",
    sub: "Python extension module",
    layer: "bridge",
    tone: "neutral",
    x: 820, y: 304, w: 240, h: 64,
    what:
      "Compiles the Rust kernel into a Python extension module (apex_arena._core). Python agents and the MCP server drive the exact same ArenaKernel the CLI uses, so results are identical across languages.",
    invariants: [
      "Prices and quantities cross the FFI boundary as i64 pips, never floats.",
      "py_verify_determinism() returns the same hashes as the CLI for the same seed and ticks.",
    ],
    files: ["crates/apex-py/src/lib.rs", "sdks/python/apex_arena/_core.abi3.so"],
    symbols: ["PyArenaKernel", "step_n()", "submit_order()", "execute_amm_swap()", "py_verify_determinism()"],
    flows: ["all", "macro", "proof"],
  },
  // ---------------- Core ----------------
  {
    id: "types",
    label: "apex-types",
    sub: "i64 fixed point",
    layer: "core",
    tone: "neutral",
    x: 40, y: 456, w: 180, h: 64,
    what:
      "The shared vocabulary of the engine: fixed-point price and quantity newtypes, orders, fills, regimes, the MacroDigest and score reports. Every other crate depends on it.",
    invariants: [
      "FixedPrice(i64) and FixedQty(i64), 100,000,000 pips = 1.0.",
      "Products such as price × qty widen to i128 and use checked or saturating math.",
      "FAST_TICK_NS = 10,000,000 and MACRO_EPOCH_TICKS = 100.",
    ],
    files: ["crates/apex-types/src/lib.rs"],
    symbols: ["SCALE", "FixedPrice", "FixedQty", "checked_notional()", "MacroDigest", "ScoreReport", "MarketRegime"],
    flows: ["all", "fast", "macro", "proof"],
  },
  {
    id: "clob",
    label: "apex-clob",
    sub: "L3 book · FIFO · STP",
    layer: "core",
    tone: "bid",
    x: 250, y: 456, w: 180, h: 64,
    what:
      "A level-3 central limit order book with price-time (FIFO) priority. Supports LIMIT, MARKET, POST_ONLY and IOC orders, a 4 bps taker fee and Cancel-Newest self-trade prevention.",
    invariants: [
      "Price ladders are BTreeMap<FixedPrice, VecDeque<Order>> — iteration order is defined.",
      "An agent can never trade with itself: the incoming order is cancelled.",
      "Post-only orders that would cross are rejected, never filled.",
    ],
    files: ["crates/apex-clob/src/lib.rs"],
    symbols: ["OrderBook", "submit_order()", "cancel_all_for_agent()", "top_levels()", "DEFAULT_TAKER_FEE_BPS = 4"],
    flows: ["all", "fast", "proof"],
  },
  {
    id: "evm",
    label: "apex-evm",
    sub: "revm 19.4 · x·y = k",
    layer: "core",
    tone: "evm",
    x: 470, y: 456, w: 190, h: 64,
    what:
      "An in-memory Ethereum VM (Bluealloy revm 19.4) hosting a Uniswap-v2-style constant-product pool with a 30 bps fee. Swaps are executed as EVM calls and emit gas-metered traces.",
    invariants: [
      "dx_net = dx · (10,000 − 30) / 10,000; dy = y · dx_net / (x + dx_net), all in i128.",
      "The fee stays in the pool, so k never decreases after a swap.",
    ],
    files: ["crates/apex-evm/src/lib.rs"],
    symbols: ["EvmAmmPool", "execute_swap()", "spot_price()", "invariant_k()", "AMM_FEE_BPS = 30"],
    flows: ["all", "fast", "proof"],
  },
  {
    id: "kernel",
    label: "apex-kernel",
    sub: "Clock, agents, portfolios",
    layer: "core",
    tone: "neutral",
    x: 700, y: 432, w: 360, h: 52,
    what:
      "The orchestrator. Each call to step_fast_tick() advances virtual time by 10 ms, steps the chaos engine, applies background-agent actions to the CLOB and the pool, marks every portfolio to market and liquidates margin breaches. Every 100th tick it runs the macro barrier.",
    invariants: [
      "A single ChaCha8Rng seeded from the run seed drives every random draw.",
      "Time is virtual_ts_ns only — no wall clock inside the simulation.",
      "Portfolios live in a BTreeMap so hashing order is stable.",
    ],
    files: ["crates/apex-kernel/src/lib.rs"],
    symbols: ["ArenaKernel::new(seed, regime)", "step_fast_tick()", "run_macro_barrier()", "telemetry_snapshot()", "verify_multi_run_determinism()"],
    flows: ["all", "fast", "macro", "proof"],
  },
  {
    id: "chaos",
    label: "Chaos",
    sub: "Hawkes",
    layer: "core",
    tone: "chaos",
    x: 700, y: 500, w: 84, h: 56,
    what:
      "A Markov-switching regime model (calm, trending, liquidity drought, flash crash) coupled to a self-exciting Hawkes process. Each shock raises the intensity λ(t), which decays geometrically in pips every tick.",
    invariants: [
      "Decay: E(t+1) = E(t) · decay / SCALE in i128 integer math.",
      "A flash crash evaporates ~350 bps of liquidity and spikes Hawkes excitation.",
    ],
    files: ["crates/apex-kernel/src/chaos.rs"],
    symbols: ["ChaosEngine", "step(tick, rng)", "trigger_flash_crash()", "hawkes_intensity_pips()", "kyle_impact_bps()"],
    flows: ["all", "fast", "proof"],
  },
  {
    id: "ecology",
    label: "Ecology",
    sub: "Agents",
    layer: "core",
    tone: "llm",
    x: 792, y: 500, w: 84, h: 56,
    what:
      "The population: ABIDES-style background agents (Ornstein-Uhlenbeck value, momentum, Avellaneda-Stoikov market maker, noise) acting every fast tick, plus the reasoning agents (Gemini-2.5, DeepSeek-R1) that only act at the macro barrier.",
    invariants: [
      "Fast-loop agents act every 10 ms; reasoning agents only see a frozen MacroDigest.",
      "Agent actions are plain enums applied in order — no callbacks, no wall clock.",
    ],
    files: ["crates/apex-kernel/src/ecology.rs"],
    symbols: ["AgentAction", "generate_fast_tick_actions()", "evaluate_macro_epoch_barrier()"],
    flows: ["all", "fast", "macro"],
  },
  {
    id: "scoring",
    label: "Scoring",
    sub: "ACS",
    layer: "core",
    tone: "bid",
    x: 884, y: 500, w: 84, h: 56,
    what:
      "Mark-to-market accounting and the Apex Composite Score. PSR(0), capped Calmar, out-of-distribution survival and a turnover penalty are all computed in integer basis points.",
    invariants: [
      "ACS = (40·PSR + 30·Calmar + 20·OOD − 10·Penalty) / 100, clamped to [0, 10,000] bps.",
      "A liquidated account scores exactly 0.",
    ],
    files: ["crates/apex-kernel/src/scoring.rs"],
    symbols: ["AgentPortfolio", "compute_score_report()", "compute_psr_zero_bps()", "normal_cdf_bps()", "update_valuation()"],
    flows: ["all", "macro"],
  },
  {
    id: "digest",
    label: "SHA-256",
    sub: "Digest",
    layer: "core",
    tone: "neutral",
    x: 976, y: 500, w: 84, h: 56,
    what:
      "A canonical hash of the entire market: seed, tick, virtual time, epoch, chaos state, every order in the book, pool reserves and every portfolio, fed in a fixed order. Equal hashes mean bit-identical state.",
    invariants: [
      "Domain-separated with the prefix APEX_ARENA_STATE_V1.",
      "Each subsystem implements feed_hash() and writes little-endian integers only.",
    ],
    files: ["crates/apex-kernel/src/lib.rs", "crates/apex-kernel/tests/determinism_suite.rs"],
    symbols: ["state_hash()", "feed_hash(&mut Sha256)", "verify_multi_run_determinism()"],
    flows: ["all", "proof"],
  },
];

export const EDGES: ArchEdge[] = [
  { from: "worker", to: "sab", label: "frames", lx: 515, ly: 90, flows: ["all", "fast"], d: "M540 104 L490 104" },
  { from: "sab", to: "views", label: "rAF", lx: 265, ly: 90, flows: ["all", "fast"], d: "M290 104 L240 104" },
  { from: "views", to: "worker", label: "commands", lx: 395, ly: 57, flows: ["all", "fast", "macro"], d: "M140 64 C140 30 650 30 650 64", dashed: true },
  { from: "views", to: "api", label: "fetch", lx: 540, ly: 146, flows: ["all", "proof"], d: "M140 128 C140 160 940 160 940 128", tone: "evm" },
  { from: "api", to: "tui", label: "execFile", lx: 765, ly: 174, flows: ["all", "proof"], d: "M880 128 L880 182 L650 182 L650 236" },
  { from: "api", to: "mcp", label: "python3", lx: 1008, ly: 178, anchor: "start", flows: ["all", "proof"], d: "M1000 128 L1000 220", tone: "llm" },
  { from: "mcp", to: "py", flows: ["all", "macro", "proof"], d: "M940 284 L940 304" },
  { from: "tui", to: "kernel", flows: ["all", "proof"], d: "M650 300 L650 400 L760 400 L760 432" },
  { from: "py", to: "kernel", label: "FFI", lx: 948, ly: 406, anchor: "start", flows: ["all", "macro", "proof"], d: "M940 368 L940 432" },
  { from: "kernel", to: "evm", flows: ["all", "fast"], d: "M700 470 L660 470", tone: "evm" },
  { from: "evm", to: "clob", label: "arb", lx: 450, ly: 480, flows: ["all", "fast"], d: "M470 496 L430 496", dashed: true },
  { from: "kernel", to: "clob", flows: ["all", "fast"], d: "M700 444 L340 444 L340 456", tone: "bid" },
  { from: "types", to: "clob", flows: ["all"], d: "M220 488 L250 488", dashed: true },
];

export const FLOW_INFO: Record<FlowMode, { label: string; caption: string }> = {
  all: { label: "Everything", caption: "All components and how they connect." },
  fast: {
    label: "Fast loop · 10 ms",
    caption:
      "Every tick: chaos engine steps, background agents quote and trade on the CLOB and the pool, portfolios mark to market, and the worker streams a frame to the UI.",
  },
  macro: {
    label: "Macro epoch · 1,000 ms",
    caption:
      "Every 100th tick the arena freezes, compiles a MacroDigest, hands it to reasoning agents (LLM, MCP, RL), applies their batch of parameter updates, and resumes.",
  },
  proof: {
    label: "Proof path",
    caption:
      "What the verification console exercises: browser → API route → native binary or Python MCP → ArenaKernel → SHA-256 digest.",
  },
};
