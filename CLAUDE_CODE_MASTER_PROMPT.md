# Claude Code Master Prompt — ApexArena Product Overhaul, UX/Readability Redesign & Commercial Polish

Copy and paste the entire prompt block below directly into **Claude Code** (`claude`), or run:
```bash
claude "$(cat CLAUDE_CODE_MASTER_PROMPT.md)"
```

---

## COPY-PASTE PROMPT FOR CLAUDE CODE

```markdown
You are a Principal Product Architect, Staff Design Engineer (Linear / Stripe / Hyperliquid / Raycast caliber), and Quantitative Systems Engineer working inside `/Users/priyanshum/Developer/Apex`.

First, read `CLAUDE.md` and `APEXARENA_CLAUDE_AND_HUMAN_MASTER_GUIDE.md` in the root directory to understand the full architecture, toolchain paths (`export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:/usr/local/bin:$PATH"`), and non-negotiable determinism invariants.

---

# 🎯 MISSION OBJECTIVES

We have a working multi-tier engine (Rust fixed-point `SCALE=10^8` L3 CLOB + embedded Bluealloy `revm` AMM + Markov-Hawkes Chaos Engine + PyO3 MCP Server + Next.js 15 Web Arena in `apps/web-arena`). However, **the current frontend UI/UX looks cramped, amateurish, hard to read, and overwhelming to a first-time viewer**.

Your job is to transform **ApexArena** into a **breathtaking, institutional-grade, deployment-ready flagship product**—far beyond the scope of a graduate Master's thesis—that is immediately understandable to a first-time human visitor while retaining 100% of its deep quantitative and systems complexity.

---

# PHASE 1: WORKSPACE AUDIT & ENVIRONMENT VERIFICATION

Before modifying code, run a fast verification pass (remembering `export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:/usr/local/bin:$PATH"`):
1. Verify the Rust workspace and 5-run SHA-256 determinism gate (`./scripts/verify_determinism_hook.sh`).
2. Verify the Python PyO3 + MCP test suite (`PYTHONPATH=sdks/python uv run --with pytest pytest sdks/python/tests/test_sdk_and_mcp.py -v`).
3. Inspect `apps/web-arena/src/` (`app/page.tsx`, `components/*`, `workers/arena.worker.ts`, `lib/sharedBuffer.ts`, `app/api/arena/route.ts`, `app/globals.css`).

---

# PHASE 2: FIX THE READABILITY, VISUAL HIERARCHY & DESIGN SYSTEM (NO MORE CRAMPED / AMATEURISH UI)

### Why the current UI feels amateurish and hard to read:
- **Microscopic Typography**: Overuse of `text-[9px]` and `text-[10px]` monospace text across every label, button, and table row causes severe eye strain and makes everything look like a wall of tiny text.
- **Cramped Single-Screen Viewport Trap**: Forcing the entire application (Order Book, Price Chart, Live Test Bench, EVM Feed, Leaderboard, Header, Footer) into a rigid `h-screen w-screen overflow-hidden` 3-column grid makes every panel feel claustrophobic, clips content on laptop screens, and destroys visual hierarchy.
- **Cryptic Jargon Without Context**: Labels like `PSR(0)`, `CALMAR`, `OOD`, `λ_t`, `x*y=k`, `STP`, and `IOC` are thrown at the user with zero explanation or progressive disclosure.

### How you MUST redesign the Design System & Layout (`apps/web-arena`):
1. **Institutional Typography & Contrast Hierarchy**:
   - Pair a crisp geometric sans-serif (`Inter` / `Geist Sans` / system sans) for **UI navigation, headings, descriptions, tooltips, and explanations** with `JetBrains Mono` (`font-variant-numeric: tabular-nums`) **strictly for prices, quantities, hashes, ticks, and code**.
   - **Minimum Font Sizes**:
     - Body text, table cells, and buttons: `12px–13px` (`text-xs` to `text-[13px]`), NEVER `9px`.
     - Panel headers & navigation tabs: `13px–14px` (`font-semibold` with clear spacing).
     - Primary KPI metrics (CLOB Mid Price, Revm Spot Price, Cross-Venue Basis, User Equity, Active Regime): `18px–24px` (`font-bold`) inside dedicated **Top KPI Summary Cards** with subtle semantic glow and delta badges.
   - **Color & Surface Polish**:
     - Deep Obsidian surfaces (`#07090E` background, `#0D1117` elevated cards, `#161B26` hover/active states, `#1E2638` crisp `1px` borders).
     - High-contrast text: `#F8FAFC` for primary values, `#CBD5E1` for standard labels, `#94A3B8` for secondary captions (eliminate low-contrast muddy grays).
     - Semantic accents: Emerald `#10B981` (Bid / Positive PnL), Rose `#F43F5E` (Ask / Liquidation / Crash), Sky `#38BDF8` (Revm AMM / On-Chain), Amber `#F59E0B` (Hawkes Chaos / Stress), Violet `#A855F7` (LLM / MCP Reasoning Agents).

2. **Multi-Workspace Navigation Architecture (Replace the Cramped Single-Screen Grid)**:
   Create a clean, spacious top navigation bar with **5 dedicated product views** (switchable via click or keyboard shortcuts `1`–`5`, while the simulation continues running seamlessly in the background):
   - **View 1: `✨ Overview & Interactive Tour` (First-Time Visitor Landing & Guided Story Mode)**
   - **View 2: `📈 Live Trading Arena` (Spacious, Ergonomic Pro Workstation)**
   - **View 3: `🤖 Agent Lab & Reasoning Inspector` (LLM/RL Decision Traces, Strategy Builder & Head-to-Head Comparison)**
   - **View 4: `🧪 Chaos Benchmark Suite` (Automated Stress-Test Runner & Institutional Scorecard Generator)**
   - **View 5: `🔐 Architecture & Determinism Proof` (Interactive System Diagram, Live Rust SHA-256 Verifier & MCP Console)**

---

# PHASE 3: PROGRESSIVE ONBOARDING & CONTEXTUAL EXPLAINERS (EASE ANYONE IN WITHOUT LOSING COMPLEXITY)

Build a seamless onboarding and educational layer so a **first-time viewer (investor, professor, engineering hiring manager, or quant trader)** immediately understands *what* is happening, *why* it matters, and *how* every component works:

1. **Interactive "Zero-to-Quant in 60 Seconds" Guided Walkthrough (`View 1` + Spotlight Tour)**:
   - Provide an interactive **Guided Walkthrough Mode** with a visual step-by-step controller (`Step 1/5` -> `Step 5/5`) that users can step through at their own pace:
     - **Step 1 — The Problem**: Why static CSV backtests fail AI trading agents (zero price impact, Goodhart's Law overfitting, wall-clock latency cheating) and how ApexArena solves it with a closed-loop reactive market ecology.
     - **Step 2 — Two Coupled Markets (CeFi CLOB vs DeFi AMM)**: Interactive visual showing how the L3 Order Book (`FIFO price-time priority`) and the embedded Ethereum `revm` Constant-Product Pool (`x · y = k`) trade the same asset (`ETH/USDT`) and create real-time cross-venue arbitrage (`Basis bps`) whenever one market moves first.
     - **Step 3 — The Weather Machine (Markov-Hawkes Chaos Engine)**: Clickable demonstration of how a `Flash Crash (350 bps)` or `450 ETH Whale Dump` excites the Hawkes intensity `λ(t)` and cascades through both venues.
     - **Step 4 — Dual-Speed Synchronization (`10ms` Fast Loop vs `1000ms` Macro Epoch)**: Animated timeline showing how fast market makers run every `10ms` while LLM/MCP reasoning agents receive a deterministic `MacroDigest` every `1000ms` without wall-clock leaks.
     - **Step 5 — The Apex Composite Score (ACS) & Instant Liquidation**: Interactive formula breakdown showing why raw PnL is a trap and how `PSR(0)`, `Calmar`, `OOD Survival`, and `5% Maintenance Margin Liquidation` separate robust intelligence from lucky leverage.

2. **"Explain This Panel" (`?`) Drawer & Interactive Formula Tooltips on Every Component**:
   - Every panel in the Live Trading Arena (`Order Book Ladder`, `Price & Basis Chart`, `Execution & Swap Desk`, `Revm Telemetry Stream`, `ACS Leaderboard`) MUST have an **"Explain (`?`)"** toggle button in its header.
   - Clicking `?` expands a clean, readable callout right inside or over the panel explaining:
     - **What you are looking at** in plain English
     - **How to interact with it** (e.g., *"Click any Ask/Bid row to auto-fill your order ticket"*)
     - **The underlying math & Rust implementation** (e.g., `FixedPrice` `SCALE = 10^8`, `x * y = k` with `30 bps` fee, `Cancel-Newest STP`).
   - Add hover/click **Concept Pills** on every metric header (`PSR(0)`, `CALMAR`, `OOD SURVIVAL`, `HAWKES λ`, `BASIS BPS`, `INVARIANT K`) that show the exact formula, plain-English meaning, and current live numeric interpretation (e.g., *"Basis is +18.4 bps: CLOB is trading $4.12 higher than the Revm AMM pool—buying ETH on the AMM and selling on the CLOB yields an instant arbitrage profit"*).

3. **Real-Time Narrative Market Ticker ("Live Market Commentary")**:
   - Add a readable **Live Market Narrative Bar** at the top of the arena that translates raw telemetry into human-readable market intelligence in real time:
     - Example in Calm regime: *"🟢 CALM REGIME — Tight 12 bps spread. Avellaneda-Alpha MM is quoting balanced two-sided liquidity; CLOB↔Revm basis is near equilibrium (1.8 bps)."*
     - Example during EVM Shock: *"🔵 EVM WHALE DUMP DETECTED — A 450 ETH swap hit the Revm AMM pool, driving on-chain ETH spot $28.50 below CLOB mid! Cross-venue arbitrageurs are buying cheap AMM ETH and selling into CLOB bids."*
     - Example during Liquidation: *"🔴 MARGIN BREACH — [RL] Hawkes-PPO breached the 5.0% maintenance margin during a 350 bps Flash Crash and was forcibly liquidated (ACS = 0.000)."*

---

# PHASE 4: BEYOND-MASTER'S-THESIS FEATURES & DEPLOYMENT-READY ENGINEERING

Elevate the technical depth and product completeness so it stands out as a premier open-source/commercial system:

1. **Spacious, Ergonomic `Live Trading Arena` (`View 2`)**:
   - **Top Row — 5 Hero KPI Cards**:
     1. `CLOB Mid Price` (with Bid/Ask spread badge & 24h-style tick delta)
     2. `Revm AMM Spot Price` (with Reserve ETH / USDT & constant product `k` summary)
     3. `Cross-Venue Arbitrage Signal` (Live Basis in `bps` + `$ spread` + 1-click **"Capture Arb"** action button when `|basis| > 5 bps`)
     4. `Active Chaos Regime & Hawkes λ(t)` (with visual danger meter & 1-click regime switcher)
     5. `Your Live Desk Portfolio ([YOU])` (Total Equity, Unrealized PnL, Inventory `ETH` / `USDT`, Margin Health bar, and Rank on Leaderboard)
   - **Main Workspace Grid (Responsive & Scrollable—Never Clipped)**:
     - **Left (`320px–360px`)**: High-readability **L3 Order Book Ladder** with visual depth bars, spread banner, cumulative depth toggle, and 1-click row-to-ticket population.
     - **Center (`flex-1`, generous height)**: **Interactive Multi-Mode Chart (`lightweight-charts`)** (`Price & Basis`, `Multi-Agent Equity Curves`, `Drawdown %`, and `Hawkes Intensity λ(t)`) + **Ergonomic Execution & Stress-Test Dock** underneath with clean, well-spaced forms and instant execution feedback toasts.
     - **Right (`380px–420px`)**: Tabbed or stacked **ACS Strategy Leaderboard** (with expandable agent cards showing full metric breakdown) + **Live Revm AMM & Fill Stream**.

2. **`🤖 Agent Lab & Reasoning Inspector` (`View 3`)**:
   - Build a dedicated view where users can inspect the **Dual-Speed Synchronization Barrier** in action:
     - Show the live **`MacroDigest` JSON payload** generated every `1000ms` (100 fast ticks).
     - Show simulated/live **Structured Reasoning Traces** for `[LLM] Gemini-3.1-Pro` and `[LLM] DeepSeek-R1` (their observation of Hawkes `λ(t)`, order book imbalance, cross-venue basis, inventory skew, and resulting JSON-RPC `submit_batch_orders` / `execute_evm_swap` calls).
     - Allow the user to **create, configure, and pit custom agents** against the built-in roster with interactive sliders for Risk Aversion ($\gamma$), Base Spread (`bps`), Inventory Target, OOD Defense Threshold, and Arbitrage Aggressiveness.

3. **`🧪 Automated Chaos Benchmark Suite & Exportable Report` (`View 4`)**:
   - Build a **1-Click "Run Standardized Benchmark Suite"** runner that executes a multi-stage stress tournament (`Stage 1: Calm Baseline` -> `Stage 2: MEV Toxic Flow` -> `Stage 3: 450 ETH AMM Whale Shock` -> `Stage 4: 350 bps Flash Cascade`) with a visual progress bar.
   - Upon completion, render an **Institutional Benchmark Scorecard** grading every agent (`S`, `A`, `B`, `C`, `F / Liquidated`) across `ACS`, `PSR(0)`, `Calmar`, `Max Drawdown`, `OOD Survival`, and `Win Rate`, with a **1-Click Export Benchmark Report (`.json` & printable report view)** including the cryptographic SHA-256 state hash.

4. **`🔐 Architecture & Determinism Explorer` (`View 5`)**:
   - Embed a native React version of the interactive architecture diagrams, the **Interactive `x * y = k` AMM vs CLOB Arbitrage Simulator**, the **Interactive ACS Calculator**, and the **Live Native Rust & Python MCP Verification Console** (calling `/api/arena` to run 5-run SHA-256 determinism checks and live Python MCP tool calls).

5. **Global Command Palette (`Cmd+K` / `Ctrl+K`) & Keyboard Shortcuts**:
   - Add a sleek `Cmd+K` command palette allowing instant access to:
     - Switching views (`Overview`, `Arena`, `Agent Lab`, `Benchmark Suite`, `Architecture`)
     - Triggering chaos scenarios (`Trigger 350bps Flash Crash`, `Dump 450 ETH on Revm AMM`, `Execute Atomic Arbitrage`)
     - Controlling playback (`Pause/Resume`, `Step +1 Tick`, `Reset Simulation`)
     - Running verification (`Verify 5-Run Rust Determinism`)

---

# PHASE 5: END-TO-END QUALITY GATES & VERIFICATION

Before finishing, verify all of the following:
1. `./scripts/verify_determinism_hook.sh` passes 100% (all Rust tests + 5-run SHA-256 equivalence).
2. `PYTHONPATH=sdks/python uv run --with pytest pytest sdks/python/tests/test_sdk_and_mcp.py -v` passes 100%.
3. `cd apps/web-arena && bun run typecheck && bun run build` completes with **zero TypeScript or Next.js production build errors**.
4. Start or verify the running server at `http://localhost:3000` and test `/api/arena` (`verify_rust_determinism`, `rust_snapshot`, `mcp_call`) to confirm live end-to-end integration.
```
