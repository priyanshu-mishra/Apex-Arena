---
description: Enforces fixed-point arithmetic, deterministic collections, ChaCha8Rng seeding, and zero wall-clock leaks in Rust crates.
globs:
  - "crates/**/*.rs"
---

# Rust Determinism & Microstructure Rules (`crates/**/*.rs`)

1. **Zero Floating-Point in Simulation State**:
   - Do not store `f32` or `f64` fields in any order book, EVM pool, portfolio, chaos state, or event struct.
   - Represent all prices with `FixedPrice(pub i64)` and quantities with `FixedQty(pub i64)` using `SCALE = 100_000_000` ($10^8$).
   - Perform cross-multiplications and notional calculations (`Price * Qty / SCALE`) using `i128` intermediates to prevent overflow.

2. **Deterministic Iteration Order**:
   - Never use `std::collections::HashMap` or `std::collections::HashSet` in simulation state.
   - Always use `std::collections::BTreeMap` and `std::collections::BTreeSet` so iteration order is canonical across all OS and CPU architectures.

3. **Seeded Cryptographic PRNG**:
   - Never use `rand::thread_rng()` or OS entropy in simulation crates (`apex-clob`, `apex-evm`, `apex-kernel`).
   - Always seed `rand_chacha::ChaCha8Rng::seed_from_u64(seed)` and pass `&mut ChaCha8Rng` explicitly.

4. **Virtual Time Discipline**:
   - Never call `std::time::SystemTime::now()` or `std::time::Instant::now()` inside `apex-types`, `apex-clob`, `apex-evm`, or `apex-kernel`.
   - Use `virtual_ts_ns: u64` incremented by `FAST_TICK_NS` (`10_000_000` ns = 10ms) per tick.

5. **Self-Trade Prevention & Accounting Integrity**:
   - All CLOB matching paths must enforce `Cancel-Newest` Self-Trade Prevention when `maker.agent_id == taker.agent_id`.
   - Every code modification in `crates/` must pass `cargo test --test determinism_suite`.
