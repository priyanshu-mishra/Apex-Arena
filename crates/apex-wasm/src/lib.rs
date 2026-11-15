//! WebAssembly bindings for the deterministic ApexArena kernel.
//!
//! Output JSON is byte-identical to `apex-tui --verify-determinism` and
//! `apex-tui --scenario X --json` (pretty-printed). Seeds are `u64`, passed from JS as `BigInt`.

use apex_kernel::{verify_multi_run_determinism, ArenaKernel};
use apex_types::MarketRegime;
use wasm_bindgen::prelude::*;

/// Mirrors `parse_regime` in `apex-tui` (unknown names fall back to flash-crash there);
/// here unknown names are reported as errors so the web app can surface them.
fn parse_regime(s: &str) -> Option<MarketRegime> {
    match s.to_ascii_lowercase().as_str() {
        "calm" => Some(MarketRegime::Calm),
        "trending" | "trend" => Some(MarketRegime::Trending),
        "drought" | "liquidity-drought" => Some(MarketRegime::LiquidityDrought),
        "flash-crash" | "flash_crash" | "crash" => Some(MarketRegime::FlashCrash),
        _ => None,
    }
}

fn error_json(msg: &str) -> String {
    serde_json::to_string_pretty(&serde_json::json!({ "error": msg })).unwrap_or_default()
}

/// 5-run SHA-256 determinism check (Calm start, flash crash injected at `ticks / 2`).
#[wasm_bindgen]
pub fn verify_determinism(seed: u64, ticks: u32) -> String {
    let ticks = ticks as u64;
    let crash_at = ticks / 2;
    let (ok, hashes) = verify_multi_run_determinism(seed, ticks, 5, Some(crash_at));
    let payload = serde_json::json!({
        "seed": seed,
        "ticks": ticks,
        "start_regime": "calm",
        "flash_crash_at_tick": crash_at,
        "runs": 5,
        "all_equal": ok,
        "hashes": hashes,
    });
    serde_json::to_string_pretty(&payload).unwrap_or_else(|e| error_json(&e.to_string()))
}

/// Telemetry snapshot after `ticks` fast ticks from `scenario` at `seed`.
#[wasm_bindgen]
pub fn snapshot(scenario: &str, seed: u64, ticks: u32) -> String {
    let Some(regime) = parse_regime(scenario) else {
        return error_json(&format!("unknown scenario: {scenario}"));
    };
    let mut kernel = ArenaKernel::new(seed, regime);
    kernel.step_n(ticks as u64);
    serde_json::to_string_pretty(&kernel.telemetry_snapshot(8))
        .unwrap_or_else(|e| error_json(&e.to_string()))
}

#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
