# ApexArena: Autonomous Multi-Agent Financial Arena & Dynamic Benchmark

**ApexArena** is an industrial-grade, bit-for-bit deterministic, multi-agent financial trading arena and dynamic AI benchmark coupling an L3 Central Limit Order Book (**CLOB**) with an embedded in-memory Ethereum Virtual Machine (**Bluealloy `revm`**) Constant Function Market Maker (**CFMM**) pool, a stylized **ABIDES** market ecology, and a **Markov-switching Hawkes Process Chaos Engine**.

---

## Core Architectural Invariants

1. **Bit-for-Bit Determinism**:
   - Zero floating-point arithmetic (`f32`/`f64`) in core state variables.
   - All prices (`FixedPrice(i64)`) and quantities (`FixedQty(i64)`) use 64-bit signed fixed-point representation scaled by $\text{SCALE} = 10^8$, with 128-bit (`i128`) intermediate notional and CFMM calculations.
   - All state maps use `BTreeMap` and `BTreeSet` with seeded `ChaCha8Rng` randomness.
   - Verified by a 5-pass SHA-256 state hash equivalence test (`./scripts/verify_determinism_hook.sh`).
2. **Dual-Speed Synchronization Barrier Clock**:
   - **Fast Microstructure Loop ($\Delta t = 10\text{ms}$)**: Executes L3 CLOB matching (Price-Time Priority + Cancel-Newest Self-Trade Prevention), in-memory `revm` swaps ($x \cdot y = k$, 30 bps fee), cross-venue arbitrage, and background ABIDES ecology agents.
   - **Slow Macro Epoch Barrier ($\Delta T = 1000\text{ms} = 100 \text{ fast ticks}$)**: Compiles a deterministic `MacroDigest` and dispatches context to reasoning agents (`Gemini-2.5`, `DeepSeek-R1`, or external MCP clients).
3. **Apex Composite Score (ACS)**:
   $$\text{ACS} = 0.40 \cdot \text{PSR}(0) + 0.30 \cdot \text{Calmar}_{\text{capped}} + 0.20 \cdot \text{Survival}_{\text{OOD}} - 0.10 \cdot \text{Penalty}_{\text{turnover}}$$

---

## Quick Start

### 1. Run the 5-Pass SHA-256 Determinism Suite & Rust Workspace Tests
```bash
./scripts/verify_determinism_hook.sh
cargo test --workspace
```

### 2. Launch the 4-Quadrant Workstation Terminal UI (`apex-tui`)
```bash
# Interactive TUI mode (Space: Pause, C: Flash Crash, D: 5-Run SHA256 Check, L: Swap Panes, Q: Quit)
cargo run -p apex-tui -- --scenario flash-crash

# Headless ASCII frame render
cargo run -p apex-tui -- --scenario flash-crash --ticks 350 --headless
```

### 3. Run the Python Strategy SDK & Model Context Protocol (MCP) Server
```bash
PYTHONPATH=sdks/python uv run --with pytest pytest sdks/python/tests/test_sdk_and_mcp.py -v
PYTHONPATH=sdks/python python3 -m apex_arena.cli verify --seed 42 --ticks 300 --runs 5
```

### 4. Launch the Next.js 15 "Obsidian Microstructure" Web Spectator Arena
```bash
cd apps/web-arena
bun run dev
```
Open `http://localhost:3000` to view the live 4-quadrant arena powered by a Dedicated WebWorker, `SharedArrayBuffer`, and TradingView `lightweight-charts`.
