//! 5-Run Bit-for-Bit SHA-256 State Equivalence Test Suite (`determinism_suite`).

use apex_kernel::{verify_multi_run_determinism, ArenaKernel};
use apex_types::{AgentStatus, MarketRegime};

#[test]
fn test_five_run_sha256_bit_for_bit_determinism() {
    let (all_equal, hashes) = verify_multi_run_determinism(42, 600, 5, Some(250));
    assert_eq!(hashes.len(), 5);
    for (idx, hash) in hashes.iter().enumerate() {
        println!("[Run {}] SHA-256 State Hash: {}", idx + 1, hash);
        assert_eq!(hash.len(), 64);
    }
    assert!(
        all_equal,
        "5-run determinism failed: state hashes diverged: {:?}",
        hashes
    );
}

#[test]
fn test_different_seeds_produce_distinct_hashes() {
    let (eq_a, hashes_a) = verify_multi_run_determinism(101, 300, 2, None);
    let (eq_b, hashes_b) = verify_multi_run_determinism(202, 300, 2, None);
    assert!(eq_a);
    assert!(eq_b);
    assert_ne!(
        hashes_a[0], hashes_b[0],
        "Distinct seeds must yield distinct SHA-256 state hashes"
    );
}

#[test]
fn test_flash_crash_regime_and_agent_differentiation() {
    let mut kernel = ArenaKernel::new(777, MarketRegime::FlashCrash);
    kernel.step_n(400);

    let snap = kernel.telemetry_snapshot(8);
    assert!(!snap.book.bids.is_empty());
    assert!(!snap.book.asks.is_empty());
    assert!(!snap.recent_evm_events.is_empty());
    assert!(!snap.recent_reasoning.is_empty());
    assert_eq!(snap.leaderboard.len(), 4);

    // Verify Gemini-2.5 outranks naive MM-Alpha during Flash Crash and MM-Alpha liquidates
    let gemini = snap
        .leaderboard
        .iter()
        .find(|r| r.agent_id == "Gemini-2.5")
        .expect("Gemini-2.5 on leaderboard");
    let mm_alpha = snap
        .leaderboard
        .iter()
        .find(|r| r.agent_id == "MM-Alpha")
        .expect("MM-Alpha on leaderboard");

    assert_eq!(gemini.status, AgentStatus::Active);
    assert_eq!(mm_alpha.status, AgentStatus::Liquidated);
    assert_eq!(mm_alpha.acs_score_bps, 0);
    assert!(gemini.acs_score_bps > mm_alpha.acs_score_bps);
}
