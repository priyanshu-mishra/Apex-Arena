# ApexArena: Zero-Context Human Onboarding, Architecture Atlas & Claude Commercial MVP Overhaul Blueprint

> **Purpose of This Document**
> 1. **For a Human Reader with Zero Prior Context**: Explains in plain, intuitive language what **ApexArena** is, why it exists, how financial order books, smart contract AMMs, and AI trading agents interact inside it, and how to test every feature live.
> 2. **For Another AI Model (Claude 3.7/4 Sonnet, Claude Opus, or Claude Code)**: Provides a complete, zero-ambiguity architectural atlas, mathematical specification, file-by-file contract map, and a **Commercial MVP Overhaul Directive** so the model can immediately understand, maintain, and evolve the entire project into a production SaaS platform that real quant developers, AI labs, and prop firms use.

---

## Part 1: Zero-Context Human Guide ("What Is ApexArena & Why Does It Matter?")

### 1.1 The Problem in Plain English: Why Traditional Backtests & AI Benchmarks Fail

Imagine you want to test whether an AI model (like Claude, Gemini, or DeepSeek) or a trading algorithm can make money in financial markets.

Today, almost everyone tests trading strategies using **historical backtesting**: they replay yesterday's recorded prices and pretend their bot bought at $2,240 and sold at $2,250.
**Why is that broken?**
1. **The "Zero Market Impact" Illusion**: In a real market, if you try to buy 500 ETH at once, you eat through the cheapest sell offers on the order book and push the price up against yourself (**slippage**). Other high-frequency bots see your order and adjust their prices immediately. Traditional backtests pretend you are invisible and have infinite liquidity.
2. **AI Models Collapse When the Rules Shift ("Out-of-Distribution" Shocks)**: Large Language Models look brilliant on static exams, but real financial markets experience sudden **Flash Crashes**, **Liquidity Droughts** (when market makers pull their orders), and **DeFi Oracle Lags** (when on-chain prices temporarily diverge from off-chain exchange prices).
3. **Speed Mismatch (10 Milliseconds vs. 1 Second)**: High-frequency trading (HFT) algorithms react in milliseconds, whereas an LLM takes ~1 second to "think" and call a tool. If you put them in a naive real-time loop, the LLM is already trading on stale prices before it finishes generating its first token.

---

### 1.2 The Solution: What ApexArena Actually Does

**ApexArena** is a **deterministic, multi-agent financial arena**—think of it as a **"Flight Simulator + Esports Arena for Trading Algorithms and AI Agents."**

Instead of replaying dead historical CSV files, ApexArena runs a **living virtual economy** with four interlocking systems:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          HOW APEXARENA WORKS IN 4 LAYERS                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  1. TWO COUPLED TRADING VENUES (Off-Chain + On-Chain)                                  │
│     ├── Venue A: L3 Central Limit Order Book (CLOB) — like Binance/Coinbase/Nasdaq     │
│     │            Matches Bids (buys) and Asks (sells) by Price-Time Priority.          │
│     └── Venue B: Embedded Ethereum Virtual Machine (Bluealloy Revm) AMM Pool           │
│                  Runs an in-memory Uniswap-style smart contract (x * y = k, 30bps fee).│
│                  When CLOB and Revm prices diverge, arbitrage bots trade between them! │
│                                                                                        │
│  2. THE DUAL-SPEED SYNCHRONIZATION BARRIER CLOCK                                       │
│     ├── Fast Loop (Every 10ms of virtual time):                                        │
│     │   Executes HFT bots, CLOB orders, Revm swaps, and background market ecology.     │
│     └── Slow Macro Barrier (Every 1000ms = 100 fast ticks):                            │
│         Pauses the clock, compiles a "Macro Digest" (order book imbalance, volatility, │
│         news wire), lets AI agents (Gemini, Claude, DeepSeek) reason and update their  │
│         strategy parameters via MCP tools, and then resumes the fast loop!             │
│                                                                                        │
│  3. THE ADVERSARIAL CHAOS ENGINE (Markov Regimes + Hawkes Process)                     │
│     └── Dynamically shifts the market between 4 states:                                │
│         [CALM] ──► [TRENDING] ──► [LIQUIDITY DROUGHT] ──► [FLASH CRASH]                │
│         During a Flash Crash, panic selling becomes "self-exciting" (each sell triggers│
│         more panic), wiping out naive bots that fail to widen their spreads.           │
│                                                                                        │
│  4. BIT-FOR-BIT CRYPTOGRAPHIC DETERMINISM (Fixed-Point SCALE = 10^8)                   │
│     └── Zero floating-point rounding drift. Every price/quantity is a 64-bit integer.  │
│         Running the arena 5 times with Seed=42 produces the EXACT same SHA-256 hash.   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.3 Meet the Competing Agents Inside the Arena

When you launch ApexArena, five distinct participant types compete simultaneously in the same order book and EVM pool:

| Agent Badge & Name | Archetype | How It Behaves | What Happens During a Flash Crash? |
| :--- | :--- | :--- | :--- |
| **`[YOU] You (Live Desk)`** | Interactive Human / Tester | Controlled live by **you** via the Web UI Order Ticket, Revm Swap Box, or MCP console ($724,000 initial equity). | You decide! Short the crash, provide wide liquidity, or arbitrage the CLOB-Revm price gap. |
| **`[AI] Gemini-2.5`** | Neuro-Symbolic LLM Market Maker | Uses the 1000ms Macro Barrier to read order book toxicity and Hawkes panic intensity. | **Survives & Profits**: Widens its bid-ask spread from `8 bps` to `38 bps` and hedges long inventory. |
| **`[AI] DeepSeek-R1`** | Macro Statistical Arbitrage AI | Monitors cross-venue basis between the off-chain CLOB and on-chain Revm AMM pool. | **Survives & Profits**: Routes defensive swaps through the Revm pool and captures mean reversion. |
| **`[QT] Hawkes-HFT`** | High-Frequency Quant Bot | Executes rapid 10ms IOC orders and `swapExactTokens` arbitrage between CLOB and Revm. | **Moderate Drawdown**: Captures arb spreads but suffers slippage spikes during oracle lags. |
| **`[QT] MM-Alpha`** | Naive Tight-Spread Market Maker | Stubbornly quotes tight `4 bps` spreads with heavy long leverage regardless of market regime. | **Liquidated (`LIQ`)**: Gets run over by toxic panic flow, breaches maintenance margin, and is disqualified (`ACS = 0`). |

---

### 1.4 How Strategies Are Ranked: The Apex Composite Score (ACS)

A strategy that makes +20% in calm markets but blows up during a 5-minute flash crash is useless in production. ApexArena ranks every participant using the **Apex Composite Score ($\text{ACS}$)** on a `0` to `100.0` scale (`0` to `10,000` bps):

$$\text{ACS} = 0.40 \cdot \text{PSR}(0) + 0.30 \cdot \text{Calmar}_{\text{capped}} + 0.20 \cdot \text{Survival}_{\text{OOD}} - 0.10 \cdot \text{Penalty}_{\text{turnover}}$$

- **$40\%$ Probabilistic Sharpe Ratio ($\text{PSR}(0)$)**: Measures return consistency adjusted for fat tails (skewness and kurtosis) so lucky one-off gambles don't rank high.
- **$30\%$ Capped Calmar Ratio**: Annualized return divided by Maximum Peak-to-Trough Drawdown.
- **$20\%$ Out-of-Distribution Survival ($\text{Survival}_{\text{OOD}}$)**: Measures performance strictly during `LIQUIDITY DROUGHT` and `FLASH CRASH` ticks.
- **$-10\%$ Turnover Penalty**: Penalizes excessive wash-like churning.
- **Instant Disqualification**: Any account breaching maintenance margin is marked `LIQ` and receives $\text{ACS} = 0$.

---

## Part 2: How to Run & Test Everything Live Right Now

### 2.1 Live Web Workstation & Interactive Test Bench (`http://localhost:3000`)

```bash
cd /Users/priyanshum/Developer/Apex/apps/web-arena
bun run dev
```

Open **`http://localhost:3000`** in your browser. Here is how to test every live capability:

1. **Click-to-Quote on the L2 Order Book (Quadrant 1, Top-Left)**:
   - Click any red `ASK` row or green `BID` row in the Order Book ladder.
   - Notice it automatically populates the **Live Execution & Stress-Test Bench** on the right with that exact USD price and opposite side!
2. **Submit Live Manual CLOB Orders (`1. CLOB` Tab in Right Bench)**:
   - Choose `▲ BUY / BID` or `▼ SELL / ASK`, select `LIMIT`, `MARKET`, `POST_ONLY`, or `IOC`, pick a size (`2.0`, `5.0`, `15.0`, `40.0 ETH`), and click **SUBMIT TO L3 CLOB**.
   - Watch your `[YOU] You (Live Desk)` row in Quadrant 4 (Leaderboard) update your live ETH inventory, cash, PnL%, and ACS score, and check **Recent Live Execution Receipts** at the bottom of the bench!
3. **Execute On-Chain Revm AMM Swaps & Atomic Arbitrage (`2. REVM` Tab in Right Bench)**:
   - Switch to `2. REVM` to inspect the live `0x0000..a9e8` pool invariant $\psi(R_1, R_2) = x \cdot y = k$.
   - Click **EXECUTE ON-CHAIN REVM SWAP** or **⚡ EXECUTE ATOMIC CLOB ↔ REVM ARBITRAGE** and watch a new `[BLK #1942...] [YOU] SWAP` transaction appear in Quadrant 2!
4. **Inject Chaos Scenarios & Deploy Custom Agents (`3. LAB` Tab in Right Bench)**:
   - Click **⚡ FLASH CRASH** or **🔮 ORACLE LAG** to shock the market and watch shaded amber hazard bands appear on the Quadrant 3 TradingView chart while `MM-Alpha` liquidates (`LIQ`).
   - Toggle the Quadrant 3 chart header between **`CLOB vs REVM`** (price action) and **`EQUITY CURVES`** (live head-to-head portfolio equity curves).
   - In `3. LAB`, name your own custom bot (e.g., `Alpha-Neuro-v1`), tune its Base Half-Spread and OOD Shock Multiplier sliders, and click **+ DEPLOY AGENT INTO TOURNAMENT** to watch it compete live!
5. **Execute Native Rust Kernel & Python MCP Tool Calls (`4. MCP/RUST` Tab in Right Bench)**:
   - Switch to `4. MCP/RUST` and click **✓ RUN NATIVE RUST 5-PASS SHA-256** to invoke the compiled Rust binary (`target/debug/apex-tui --verify-determinism`) via the Next.js API route (`/api/arena`) and see all 5 64-character SHA-256 hashes verified live.
   - Select any MCP tool (`get_market_digest`, `get_orderbook_l2`, `submit_clob_order`, `execute_evm_swap`, `trigger_chaos_regime`) and click **CALL MCP** to execute a real JSON-RPC 2.0 call against the Python PyO3 MCP server!

---

### 2.2 Terminal Workstation UI (`apex-tui`), Python SDK & Determinism Hook

```bash
# 1. Run the 5-Pass SHA-256 Determinism Gate & Full Rust Test Suite
./scripts/verify_determinism_hook.sh

# 2. Launch the Interactive 4-Quadrant Ratatui Terminal UI
cargo run -p apex-tui -- --scenario flash-crash

# 3. Run the Python PyO3 Strategy SDK & MCP Server Test Suite
PYTHONPATH=sdks/python uv run --with pytest pytest sdks/python/tests/test_sdk_and_mcp.py -v
```

---

## Part 3: Complete Codebase Atlas (File-by-File Map)

```text
/Users/priyanshum/Developer/Apex/
├── Cargo.toml                                 # Rust Workspace Root (6 crates)
├── .cargo/config.toml                         # PyO3 ABI3 forward-compatibility & macOS linker flags
├── .agents/
│   ├── AGENTS.md                              # Master Architectural Constitution
│   ├── hooks.json                             # Post-edit & pre-submit determinism gates
│   ├── mcp_config.json                        # Model Context Protocol server registration
│   ├── rules/
│   │   ├── rust-determinism.md                # Enforces FixedPrice/FixedQty, BTreeMap, ChaCha8Rng
│   │   └── ui-cyber-terminal.md               # Enforces Obsidian Microstructure tokens & 0px radius
│   ├── agents/                                # 4 Specialist Subagent Definitions
│   └── skills/verify-arena-determinism/       # 5-Run SHA-256 verification skill runbook
├── scripts/
│   └── verify_determinism_hook.sh             # Static audit + 5-pass SHA-256 test runner
├── crates/
│   ├── apex-types/src/lib.rs                  # SCALE=10^8 FixedPrice(i64), FixedQty(i64), schemas
│   ├── apex-clob/src/lib.rs                   # BTreeMap L3 OrderBook, Price-Time Priority, Cancel-Newest STP
│   ├── apex-evm/src/lib.rs                    # Bluealloy Revm CacheDB<EmptyDB>, x*y=k CFMM (30bps fee)
│   ├── apex-kernel/
│   │   ├── src/lib.rs                         # ArenaKernel, Dual-Speed Barrier Clock, SHA-256 state_hash()
│   │   ├── src/chaos.rs                       # 4x4 Markov Regime Engine + Integer Hawkes Process
│   │   ├── src/ecology.rs                     # ABIDES background ecology + Gemini-2.5, DeepSeek-R1, Hawkes-HFT, MM-Alpha
│   │   ├── src/scoring.rs                     # Portfolio accounting, PSR(0), Capped Calmar, OOD Survival, ACS
│   │   └── tests/determinism_suite.rs         # 5-pass SHA-256 bit-for-bit equivalence tests
│   ├── apex-tui/
│   │   ├── src/main.rs                        # Interactive & Headless/JSON CLI entry point
│   │   └── src/ui.rs                          # Ratatui 4-Quadrant Obsidian Microstructure renderer
│   └── apex-py/src/lib.rs                     # PyO3 native extension (`apex_arena._core`)
├── sdks/python/
│   ├── pyproject.toml                         # Python package & `apex` CLI entry point
│   ├── apex_arena/
│   │   ├── engine.py                          # High-level ArenaEngine wrapper over PyO3 `_core`
│   │   ├── agent.py                           # ApexAgent base class & HybridLLMMarketMaker template
│   │   ├── mcp_server.py                      # JSON-RPC 2.0 Model Context Protocol server (7 tools)
│   │   └── cli.py                             # `apex init`, `apex test`, `apex verify`, `apex mcp`
│   └── tests/test_sdk_and_mcp.py              # Pytest suite for PyO3 bindings, agents, and MCP tools
└── apps/web-arena/
    ├── next.config.ts                         # COOP/COEP headers enabling SharedArrayBuffer
    ├── public/guide.html                      # Standalone Interactive Visual Guide & Claude Spec
    └── src/
        ├── app/
        │   ├── globals.css                    # Obsidian Microstructure CSS tokens (#050505, #0B0C10, #1C202B)
        │   ├── page.tsx                       # 4-Quadrant Workstation + Live Execution Dock + 60Hz rAF loop
        │   └── api/arena/route.ts             # Native Rust Kernel & Python MCP backend bridge
        ├── lib/sharedBuffer.ts                # SharedArrayBuffer layout & TypeScript schemas
        ├── workers/arena.worker.ts            # Off-main-thread WebWorker simulation & binary encoder
        └── components/
            ├── OrderBookLadder.tsx            # Quadrant 1: Click-to-quote L2 depth ladder
            ├── PriceRegimeChart.tsx           # Quadrant 3: TradingView Lightweight Charts + Canvas Chaos overlay
            ├── EvmTelemetryFeed.tsx           # Quadrant 2: Filterable Revm smart contract trace stream
            ├── LeaderboardPanel.tsx           # Quadrant 4: Live ACS leaderboard & Macro LLM reasoning feed
            └── LiveTestBench.tsx              # Right Dock: CLOB Order Ticket, Revm Swap, Agent Lab, Rust/MCP Console
```

---

## Part 4: Master Prompt & Commercial MVP Overhaul Blueprint for Claude

Copy and paste the block below directly into **Claude (Claude Opus / Sonnet / Claude Code)** to give it complete context and instruct it to evolve **ApexArena** into a commercially viable, venture-scale SaaS product.

```markdown
# SYSTEM ROLE & MASTER ARCHITECTURAL BRIEF FOR CLAUDE

You are acting as the **Principal Distributed Systems Architect, Lead Quantitative Microstructure Engineer, and Product Engineering Lead** for **ApexArena** (`/Users/priyanshum/Developer/Apex`).

## 1. WHAT APEXARENA IS (ZERO-CONTEXT SUMMARY)
ApexArena is a deterministic, multi-agent financial trading arena and dynamic AI benchmark that couples:
1. **An Off-Chain L3 Central Limit Order Book (`crates/apex-clob`)**: Price-time priority matching (`BTreeMap<FixedPrice, VecDeque<Order>>`), `Limit`/`Market`/`PostOnly`/`IOC` orders, and `Cancel-Newest` Self-Trade Prevention (STP).
2. **An On-Chain In-Memory EVM DEX Sandbox (`crates/apex-evm`)**: Embeds Bluealloy `revm` (`CacheDB<EmptyDB>`) running a constant-product Automated Market Maker ($\psi(R_{\text{base}}, R_{\text{quote}}) = R_{\text{base}} \cdot R_{\text{quote}} = k$) with a 30 bps swap fee at contract `0x000000000000000000000000000000000000a9e8`.
3. **A Dual-Speed Synchronization Barrier Clock (`crates/apex-kernel`)**:
   - **Fast Microstructure Loop ($\Delta t = 10\text{ms} = 10,000,000\text{ns}$)**: Executes HFT bots, CLOB matching, Revm swaps, cross-venue arbitrage, and 4 stylized ABIDES market ecology archetypes (`Noise`, `OUValue`, `Momentum`, `AdaptiveMarketMaker`).
   - **Slow Macro Epoch Barrier ($\Delta T = 1000\text{ms} = 100 \text{ fast ticks}$)**: Freezes simulation advancement, compiles a deterministic `MacroDigest` (L2 imbalance, realized vol, Hawkes intensity, news wire), and dispatches state to LLM reasoning agents (`Gemini-2.5`, `DeepSeek-R1`, or external MCP clients) to update quoting parameters or submit orders.
4. **An Adversarial Chaos Engine (`crates/apex-kernel/src/chaos.rs`)**:
   - 4-state Markov regime chain (`Calm`, `Trending`, `LiquidityDrought`, `FlashCrash`) governed by a $4 \times 4$ transition matrix and a self-exciting Hawkes process $\lambda(t) = \lambda_0 + \sum_{t_i < t} \alpha e^{-\beta(t - t_i)}$.
5. **Quantitative Ranking via Apex Composite Score (`crates/apex-kernel/src/scoring.rs`)**:
   $$\text{ACS} = 0.40 \cdot \text{PSR}(0) + 0.30 \cdot \text{Calmar}_{\text{capped}} + 0.20 \cdot \text{Survival}_{\text{OOD}} - 0.10 \cdot \text{Penalty}_{\text{turnover}}$$
   Accounts breaching maintenance margin are immediately liquidated (`AgentStatus::Liquidated`, $\text{ACS} = 0$).

## 2. NON-NEGOTIABLE CORE INVARIANTS (NEVER VIOLATE)
1. **Bit-for-Bit Determinism**:
   - Zero `f32`/`f64` in core Rust simulation state (`apex-types`, `apex-clob`, `apex-evm`, `apex-kernel`).
   - All prices use `FixedPrice(pub i64)` and quantities use `FixedQty(pub i64)` scaled by `SCALE = 100_000_000` ($10^8$), with `i128` intermediate notional math.
   - Never use `HashMap` or `HashSet` in engine state; strictly use `BTreeMap` and `BTreeSet`.
   - Never use `SystemTime::now()`, `Instant::now()`, or `thread_rng()` in core crates; strictly use `virtual_ts_ns: u64` and `ChaCha8Rng::seed_from_u64(seed)`.
   - Every change to `crates/` must pass `./scripts/verify_determinism_hook.sh` (5-run SHA-256 bit-for-bit state hash equality).
2. **Visual Design System ("Obsidian Microstructure")**:
   - `--bg-void: #050505`, `--bg-panel: #0B0C10`, `--bg-elevated: #12151D`, `--border-grid: #1C202B` (`1px solid`, `border-radius: 0px`), `--color-bid: #00F59B`, `--color-ask: #FF2E54`, `--color-evm: #38BDF8`, `--color-chaos: #F59E0B`, `--color-llm: #A855F7`.
   - Enforce `font-variant-numeric: tabular-nums` across all numeric telemetry.

## 3. COMMERCIAL MVP PRODUCT VISION & OVERHAUL ROADMAP
Your objective is to evolve ApexArena into a **commercially viable, sticky product that quant developers, AI researchers, and prop trading firms actively use and pay for**. Focus on the following high-impact product pillars:

### Pillar A: Live Multi-Model BYOK LLM Arena ("Real LLM Inference at the 1000ms Macro Barrier")
- Build an asynchronous LLM Macro-Barrier Dispatcher in `sdks/python/apex_arena/` and `apps/web-arena/` supporting **Bring-Your-Own-Key (BYOK)** for **Anthropic Claude (`claude-sonnet-4` / `claude-opus-4`)**, **Google Gemini**, **OpenAI**, and **OpenRouter**.
- At every 1000ms Macro Epoch Barrier, serialize `MacroDigest` into a structured tool-use prompt, enforce a strict JSON schema / MCP tool call (`set_mm_params`, `submit_clob_order`, `execute_evm_swap`), record the exact model response + token latency, and hash the deterministic output into the simulation's audit trail so replays remain 100% deterministic.

### Pillar B: Persistent Rust Axum WebSocket + DuckDB Tournament Server (`crates/apex-server`)
- Create a dedicated Rust backend crate `crates/apex-server` using `axum` and `tokio` that hosts continuous multi-room tournaments:
  - Streams binary/JSON `TickTelemetry` frames over WebSockets (`ws://localhost:8080/ws/arena/:room_id`).
  - Accepts live authenticated REST/WebSocket order submissions and strategy registrations from Python/Rust SDK clients.
  - Persists tick-by-tick match replays, L3 fills, Revm traces, and final SHA-256 state attestations to local SQLite/DuckDB Parquet files for instant historical scrub-and-replay in the Web UI.

### Pillar C: Strategy Code Editor, Backtest Diffing & Shareable Match Permalinks in `apps/web-arena`
- Add an in-browser Strategy Editor & Backtest Comparison Matrix where a user can:
  1. Write or customize a Python/TypeScript/DSL `on_tick` + `on_macro_epoch` strategy directly in the browser.
  2. Run a 1,000-tick multi-seed Monte Carlo stress test across `Calm`, `Trending`, `LiquidityDrought`, and `FlashCrash` regimes in under 2 seconds via the native Rust kernel.
  3. Compare **Strategy V1 vs. Strategy V2** side-by-side across Equity Curves, Underwater Drawdown Charts, Fill Attribution (Maker vs. Taker vs. AMM Arb PnL), and signed SHA-256 verification receipts.

## 4. VERIFICATION COMMANDS TO RUN AFTER EVERY CHANGE
```bash
export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:/usr/local/bin:$PATH"
./scripts/verify_determinism_hook.sh
cargo test --workspace
PYTHONPATH=sdks/python uv run --with pytest pytest sdks/python/tests/test_sdk_and_mcp.py -v
cd apps/web-arena && bun run typecheck && bun run build
```
```
