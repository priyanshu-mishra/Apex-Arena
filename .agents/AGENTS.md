# ApexArena: Master Architectural Constitution

## 1. Mission & System Overview
**ApexArena** is an industrial-grade, deterministic, multi-agent financial trading arena and dynamic AI benchmark coupling an L3 Central Limit Order Book (**CLOB**) with an embedded in-memory Ethereum Virtual Machine (**Bluealloy `revm`**) Automated Market Maker (**AMM**) sandbox, an **ABIDES** background market ecology, and a **Markov-switching Hawkes Process Chaos Engine**.

## 2. Non-Negotiable Core Invariants

### 2.1 Bit-for-Bit Determinism
- Every simulation run with an identical 64-bit random seed (`seed: u64`) and identical initial configuration **MUST** produce an identical SHA-256 state hash across 5 consecutive executions (`cargo test --test determinism_suite`).
- Floating-point arithmetic (`f32`, `f64`) is **strictly prohibited** in core state storage, matching logic, AMM reserve math, and portfolio accounting.
- All prices and quantities are stored as signed 64-bit fixed-point integers (`FixedPrice(pub i64)`, `FixedQty(pub i64)`) scaled by:
  $$\text{SCALE} = 10^8 \quad (1.00000000 = 100,000,000 \text{ integer pips})$$
- Intermediate notional products and CFMM invariant calculations must use 128-bit integers (`i128`) with checked division by `SCALE`.
- Non-deterministic hash collections (`std::collections::HashMap`, `std::collections::HashSet`) are banned in engine state; use `std::collections::BTreeMap` and `std::collections::BTreeSet` exclusively.
- Random number generation must use `rand_chacha::ChaCha8Rng::seed_from_u64(seed)`.

### 2.2 Zero Wall-Clock Leaks
- Never invoke `std::time::SystemTime::now()` or `std::time::Instant::now()` inside order matching, EVM execution, chaos transitions, or strategy callbacks.
- All timestamps are driven strictly by `virtual_ts_ns: u64`.
- **Dual-Speed Synchronization Barrier**:
  - **Fast Loop ($\Delta t = 10\text{ms} = 10,000,000\text{ns}$)**: Processes CLOB orders, Cancel-Newest Self-Trade Prevention, Revm AMM swaps, cross-venue arbitrage, and background ABIDES ecology agents.
  - **Slow Macro Epoch ($\Delta T = 1000\text{ms} = 100 \text{ fast ticks}$)**: Freezes simulation advancement, compiles a deterministic `MacroDigest`, dispatches state to reasoning agents (LLM/MCP or neuro-symbolic strategy hooks), applies updated parameters/orders, and resumes the fast loop.

### 2.3 Quantitative Scoring: Apex Composite Score (ACS)
Strategies are ranked using the Apex Composite Score:
$$\text{ACS} = 0.40 \cdot \text{PSR}(0) + 0.30 \cdot \text{Calmar}_{\text{capped}} + 0.20 \cdot \text{Survival}_{\text{OOD}} - 0.10 \cdot \text{Penalty}_{\text{turnover}}$$
Accounts breaching maintenance margin are immediately liquidated and disqualified ($\text{ACS} = 0$).

### 2.4 Visual Design System: "Obsidian Microstructure"
- Canvas Void: `#050505` | Structural Panel: `#0B0C10` | Elevated Row/Header: `#12151D`
- Grid Dividers: `1px solid #1C202B` with `0px` border radius (`border-radius: 0px`)
- Semantic Accents: Bid `#00F59B` | Ask `#FF2E54` | EVM `#38BDF8` | Chaos `#F59E0B` | LLM `#A855F7`
- Typography: Monospace (`JetBrains Mono` / `Berkeley Mono`) with `font-variant-numeric: tabular-nums` on all numeric telemetry.
