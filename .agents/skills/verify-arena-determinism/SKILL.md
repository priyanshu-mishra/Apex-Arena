---
name: verify-arena-determinism
description: Runbook and verification workflow for validating 5-run SHA-256 bit-for-bit state hash equivalence across the ApexArena kernel, CLOB, and embedded Revm sandbox.
---

# Verify Arena Determinism (`verify-arena-determinism`)

Use this skill whenever modifying matching logic (`crates/apex-clob`), embedded EVM execution (`crates/apex-evm`), fixed-point arithmetic (`crates/apex-types`), or kernel chaos/ecology loops (`crates/apex-kernel`).

## Verification Workflow

1. **Static Audit for Non-Deterministic Constructs**:
   Ensure zero occurrences of `HashMap`, `HashSet`, `SystemTime::now`, `Instant::now`, or `thread_rng` in `crates/apex-types`, `crates/apex-clob`, `crates/apex-evm`, and `crates/apex-kernel`.

2. **Execute the 5-Pass SHA-256 Equivalence Suite**:
   ```bash
   ./scripts/verify_determinism_hook.sh
   ```
   Or directly via Cargo:
   ```bash
   export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"
   cargo test --test determinism_suite -- --nocapture
   ```

3. **Expected Output**:
   - All 5 simulation runs with identical seeds (`seed = 42`, `seed = 1337`) across 1,000+ ticks (including `Calm`, `Trending`, `LiquidityDrought`, and `FlashCrash` transitions, CLOB matches, Cancel-Newest STP triggers, Revm AMM swaps, and Macro Epoch barriers) must emit identical 64-character hexadecimal SHA-256 digests.
   - Runs with distinct seeds must emit distinct SHA-256 digests.
