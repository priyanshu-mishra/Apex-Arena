# CLAUDE.md — ApexArena Project Memory & Engineering Constitution

This file provides automatic context for **Claude Code** (`claude`) when working inside `/Users/priyanshum/Developer/Apex`.

---

## 1. Environment & Toolchain Setup (CRITICAL on this macOS Machine)

Rust (`cargo`, `rustc`) and `bun` live in `/opt/homebrew/bin` and `$HOME/.cargo/bin`. Always prefix shell commands with:
```bash
export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:/usr/local/bin:$PATH"
```

### Quick Verification Commands
```bash
# 1. Run full Rust workspace tests + 5-run SHA-256 determinism gate
export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:/usr/local/bin:$PATH"
./scripts/verify_determinism_hook.sh

# 2. Run native Rust TUI in headless JSON mode
cargo run -p apex-tui -- --scenario flash-crash --seed 42 --ticks 250 --json

# 3. Run Python PyO3 SDK & MCP JSON-RPC 2.0 tests
PYTHONPATH=sdks/python uv run --with pytest pytest sdks/python/tests/test_sdk_and_mcp.py -v

# 4. Typecheck & build the Next.js 15 Web Workstation
cd apps/web-arena && bun run typecheck && bun run build

# 5. Start Next.js 15 Web Workstation dev server (http://localhost:3000)
cd apps/web-arena && bun run dev
```

---

## 2. What ApexArena Is

**ApexArena** is a deterministic, multi-agent financial trading arena and dynamic AI benchmark that couples:
1. **L3 Central Limit Order Book (`crates/apex-clob`)**: Price-time FIFO matching, Cancel-Newest Self-Trade Prevention (STP), `LIMIT`, `MARKET`, `POST_ONLY`, and `IOC` orders.
2. **Embedded EVM Constant-Product AMM (`crates/apex-evm`)**: In-memory Bluealloy `revm` (`v19.4.0`) + `alloy-primitives` executing `x * y = k` constant-product swaps (`30 bps` fee) and atomic CLOB↔AMM cross-venue arbitrage.
3. **ABIDES Ecology & Markov-Switching Hawkes Chaos Engine (`crates/apex-kernel`)**:
   - **Dual-Speed Synchronization Barrier**:
     - **Fast Loop (`Δt = 10ms = 10,000,000ns`)**: Matches CLOB orders, executes EVM swaps, steps background ABIDES agents (`Ornstein-Uhlenbeck Value`, `Momentum`, `Avellaneda-Stoikov MM`, `Noise`), and updates self-exciting Hawkes intensity `λ(t)`.
     - **Slow Macro Epoch (`ΔT = 1000ms = 100 fast ticks`)**: Freezes the arena, compiles a deterministic `MacroDigest`, dispatches to reasoning agents (LLM / MCP / RL), applies batch orders, and resumes.
   - **4 Market Regimes**: `Calm`, `ToxicFlow`, `FlashCrash` (350 bps liquidity evaporation), and `EvmShock` (on-chain whale AMM dump).
   - **Apex Composite Score (ACS)**:
     $$\text{ACS} = 0.40 \cdot \text{PSR}(0) + 0.30 \cdot \text{Calmar}_{\text{capped}} + 0.20 \cdot \text{Survival}_{\text{OOD}} - 0.10 \cdot \text{Penalty}_{\text{turnover}}$$
     Accounts breaching the `5%` maintenance margin are immediately liquidated and disqualified (`ACS = 0`).
4. **PyO3 Native Bridge & JSON-RPC 2.0 MCP Server (`crates/apex-py`, `sdks/python/apex_arena`)**: Exposes `get_market_digest`, `submit_batch_orders`, and `execute_evm_swap`.
5. **Next.js 15 Interactive Web Workstation (`apps/web-arena`)**: Browser workstation powered by a WebWorker (`src/workers/arena.worker.ts`) and a live backend API bridge (`src/app/api/arena/route.ts`) that invokes the compiled Rust binary (`target/debug/apex-tui`) and Python MCP server (`ApexMcpServer`).

---

## 3. Non-Negotiable Core Invariants (Must Never Be Broken)

1. **Bit-for-Bit Determinism in Rust**:
   - 5 consecutive runs with `seed = 42` MUST produce the exact same SHA-256 state hash (`./scripts/verify_determinism_hook.sh`).
   - Zero `f32`/`f64` in core Rust state, order matching, AMM math, or portfolio accounting. All prices/quantities use `FixedPrice(i64)` and `FixedQty(i64)` with `SCALE = 10^8` (`100_000_000` pips = `1.0`). Intermediate products use `i128`.
   - Use `BTreeMap` and `BTreeSet` exclusively in Rust state (never `HashMap`/`HashSet`).
   - Use `ChaCha8Rng::seed_from_u64(seed)` for all randomness.
   - Zero `SystemTime::now()` or `Instant::now()` inside simulation logic; all time advances strictly via `virtual_ts_ns: u64`.
2. **Monotonic Timestamps in Web Charts**:
   - TradingView `lightweight-charts` v5 throws a fatal assertion error if `series.setData()` receives duplicate or non-ascending timestamps. Every simulation frame or user action in `arena.worker.ts` must advance `tick`/`timeSec` monotonically, and chart components must deduplicate/sort by `timeSec`.

---

## 4. Repository Map

- `crates/apex-types/src/lib.rs` — `FixedPrice`, `FixedQty` (`SCALE = 10^8`), orders, fills, regimes, snapshots.
- `crates/apex-clob/src/lib.rs` — Deterministic L3 `OrderBook` (`BTreeMap` ladders, FIFO queues, Cancel-Newest STP).
- `crates/apex-evm/src/lib.rs` — Bluealloy `revm` `EvmPool` (`x * y = k`, `30 bps` fee) + `compute_optimal_arb_qty`.
- `crates/apex-kernel/src/{lib.rs,chaos.rs,ecology.rs,scoring.rs}` — `ArenaKernel`, Markov-Hawkes engine, ABIDES agents, ACS scoring, SHA-256 state digest.
- `crates/apex-tui/src/{main.rs,ui.rs}` — Ratatui 4-quadrant TUI + `--headless`, `--json`, and `--verify-determinism` CLI modes.
- `crates/apex-py/src/lib.rs` & `sdks/python/apex_arena/` — PyO3 native extension (`_core.abi3.so`) + Python SDK + MCP server.
- `apps/web-arena/src/` — Next.js 15 React 19 Web Workstation:
  - `app/page.tsx` — Main application shell & view orchestrator.
  - `app/api/arena/route.ts` — Backend API bridge to native Rust `apex-tui` and Python `ApexMcpServer`.
  - `workers/arena.worker.ts` — High-frequency simulation WebWorker, user trading desk (`[YOU]`), custom agent runner, and scenario injector.
  - `lib/sharedBuffer.ts` — Shared TypeScript interfaces and zero-copy `SharedArrayBuffer` ring buffer layout.
  - `components/OrderBookLadder.tsx` — L3 CLOB ladder with click-to-quote.
  - `components/PriceRegimeChart.tsx` — TradingView `lightweight-charts` v5 canvas (CLOB vs Revm price & multi-agent equity curves).
  - `components/EvmTelemetryFeed.tsx` — Revm AMM telemetry & swap stream.
  - `components/LeaderboardPanel.tsx` — Live ACS leaderboard & liquidation tracker.
  - `components/LiveTestBench.tsx` — 4-tab live order ticket, AMM swapper, chaos scenario lab, and native Rust/MCP verifier.
