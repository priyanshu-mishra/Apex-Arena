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
4. **PyO3 Native Bridge & JSON-RPC 2.0 MCP Server (`crates/apex-py`, `sdks/python/apex_arena`)**: Exposes 7 tools: `get_market_digest`, `get_orderbook_l2`, `submit_clob_order`, `execute_evm_swap`, `trigger_chaos_regime`, `get_leaderboard`, and `verify_determinism` (there is no batch-order tool; the stdio server takes one JSON-RPC request per line).
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
  - `app/page.tsx` — Mounts `ArenaProvider` + `AppShell`.
  - `app/api/arena/route.ts` — Backend API bridge to native Rust `apex-tui` and Python `ApexMcpServer`. Actions: `verify_rust_determinism`, `rust_snapshot`, `mcp_call`, `tools_list` (inputs allow-listed and clamped).
  - `app/globals.css` + `styles/tokens.css` — Canyon tokens on Tailwind v4 `@theme` (Archivo for words, Martian Mono for numbers; 2px radius; 12px minimum text).
  - `workers/arena.worker.ts` — In-browser JS port of the kernel (simulation, `[YOU]` desk, custom agents, scenarios incl. `whale-dump`/`toxic-flow`, `CAPTURE_ARB`, offline `RUN_BENCHMARK`). Its state digest is FNV-1a 256-bit, NOT SHA-256 — only the Rust kernel uses SHA-256.
  - `lib/arena.tsx` — `ArenaProvider` / `useArena()`: sole owner of the worker; frame, history, actions, toasts, benchmark and determinism state shared by all views.
  - `lib/sharedBuffer.ts` — Shared telemetry/benchmark types and `SharedArrayBuffer` layout. `lib/concepts.ts` (jargon → formula + live interpretation), `lib/narrative.ts` (live market commentary).
  - `components/app-shell/` — App shell in the landing's language: top bar (sections, keys `1`–`4`; Simple / Pro density switch; pause, Space / `.` step), regime-tinted header horizon light, narrative line, landing-style status line, toasts, `⌘K` command menu (shadcn Command). `lib/density.ts` — `useDensity()`, `<Pro>`, `<Simple>` (`localStorage['apex-density']`, default Simple).
  - `components/ui/` — `Panel` (with "?" explain), `ConceptPill`, `KpiCard`, `Badge`, `Meter`, `Segmented`, `Tabs` on Tailwind; `ui/kit.ts` holds the shared class strings (buttons, inputs, tables, type); `ui/shadcn/` the shadcn primitives.
  - `components/views/` + per-view folders — `OverviewView` (`overview/`, guided tour), `ArenaView` (`arena/`: KPIs, order book, lightweight-charts v5 chart, execution dock, leaderboard), `AgentLabView` (`lab/`: MacroDigest, reasoning traces, agent builder), `BenchmarkView` (`bench/`: 4-stage suite, scorecard, JSON/print export), `ArchitectureView` (`arch/`: diagram, verification console, AMM/ACS calculators). App pages are styled with Tailwind utilities only (no CSS modules; a Vitest fs test guards it); Simple shows the story set, `<Pro>` wraps the advanced panels.
  - Production build beside a running dev server: `NEXT_DIST_DIR=.next-build bun run build`.
