//! Adversarial Chaos & Regime-Switching Engine.
//!
//! Models discrete regime transitions (`Calm`, `Trending`, `LiquidityDrought`, `FlashCrash`)
//! via the 4x4 Markov chain transition matrix $P$ and panic selling cascades via a
//! self-exciting Hawkes process $\lambda(t) = \lambda_0 + \sum_{t_i < t} \alpha e^{-\beta(t - t_i)}$
//! using pure integer fixed-point arithmetic (`SCALE = 10^8`).

use apex_types::{FixedPrice, MarketRegime, SCALE};
use rand::Rng;
use rand_chacha::ChaCha8Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Base Hawkes intensity $\lambda_0 = 0.20 \times 10^8$.
pub const HAWKES_BASE_INTENSITY: i64 = 20_000_000;
/// Self-excitation jump size $\alpha = 0.35 \times 10^8$.
pub const HAWKES_ALPHA: i64 = 35_000_000;
/// Exponential decay factor $e^{-\beta \Delta t} \approx 0.94 \times 10^8$ per tick.
pub const HAWKES_DECAY_FACTOR: i64 = 94_000_000;
/// Panic threshold $\Lambda_{\text{panic}} = 1.50 \times 10^8$ where liquidity vacuum triggers.
pub const HAWKES_PANIC_THRESHOLD: i64 = 150_000_000;

/// 4x4 Markov transition matrix scaled to 1,000 parts per row:
/// Rows/Cols: 0 = Calm, 1 = Trending, 2 = LiquidityDrought, 3 = FlashCrash
/// P = [
///   [0.980, 0.010, 0.005, 0.005],
///   [0.030, 0.940, 0.020, 0.010],
///   [0.050, 0.020, 0.900, 0.030],
///   [0.080, 0.010, 0.010, 0.900],
/// ]
const TRANSITION_MATRIX_PER_MILLE: [[u32; 4]; 4] = [
    [980, 10, 5, 5],
    [30, 940, 20, 10],
    [50, 20, 900, 30],
    [80, 10, 10, 900],
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChaosEngine {
    regime: MarketRegime,
    hawkes_excitation_pips: i64,
    fundamental_value: FixedPrice,
    ou_mean_price: FixedPrice,
    regime_lock_ticks: u64,
    total_regime_shifts: u64,
    last_headline: String,
}

impl ChaosEngine {
    pub fn new(initial_regime: MarketRegime, initial_price: FixedPrice) -> Self {
        let headline = Self::headline_for_regime(initial_regime, 0);
        Self {
            regime: initial_regime,
            hawkes_excitation_pips: if initial_regime == MarketRegime::FlashCrash {
                HAWKES_PANIC_THRESHOLD
            } else {
                0
            },
            fundamental_value: initial_price,
            ou_mean_price: initial_price,
            regime_lock_ticks: 0,
            total_regime_shifts: 0,
            last_headline: headline,
        }
    }

    #[inline]
    pub fn regime(&self) -> MarketRegime {
        self.regime
    }

    #[inline]
    pub fn hawkes_intensity_pips(&self) -> i64 {
        HAWKES_BASE_INTENSITY.saturating_add(self.hawkes_excitation_pips)
    }

    #[inline]
    pub fn is_liquidity_vacuum(&self) -> bool {
        self.hawkes_intensity_pips() >= HAWKES_PANIC_THRESHOLD
            || self.regime.is_ood()
    }

    #[inline]
    pub fn fundamental_value(&self) -> FixedPrice {
        self.fundamental_value
    }

    #[inline]
    pub fn last_headline(&self) -> &str {
        &self.last_headline
    }

    /// Forces an immediate transition into `FlashCrash` and spikes Hawkes self-excitation.
    pub fn trigger_flash_crash(&mut self, tick: u64) {
        self.regime = MarketRegime::FlashCrash;
        self.hawkes_excitation_pips =
            self.hawkes_excitation_pips.saturating_add(HAWKES_PANIC_THRESHOLD * 2);
        self.fundamental_value = self.fundamental_value.apply_bps(-180); // -1.80% immediate fundamental shock
        self.regime_lock_ticks = 45;
        self.total_regime_shifts += 1;
        self.last_headline = Self::headline_for_regime(MarketRegime::FlashCrash, tick);
    }

    /// Explicitly sets the active market regime.
    pub fn set_regime(&mut self, regime: MarketRegime, tick: u64) {
        self.regime = regime;
        if regime == MarketRegime::FlashCrash {
            self.hawkes_excitation_pips = HAWKES_PANIC_THRESHOLD * 2;
            self.regime_lock_ticks = 40;
        } else if regime == MarketRegime::LiquidityDrought {
            self.hawkes_excitation_pips = HAWKES_PANIC_THRESHOLD;
            self.regime_lock_ticks = 30;
        }
        self.last_headline = Self::headline_for_regime(regime, tick);
    }

    /// Steps the Markov-switching jump-diffusion and Hawkes intensity process for 1 fast tick.
    pub fn step(&mut self, tick: u64, rng: &mut ChaCha8Rng) -> (MarketRegime, bool) {
        // 1. Exponential decay of Hawkes excitation: E_{t+1} = (E_t * decay) / SCALE
        self.hawkes_excitation_pips =
            ((self.hawkes_excitation_pips as i128 * HAWKES_DECAY_FACTOR as i128) / SCALE as i128)
                as i64;

        // 2. Check Markov regime transition every 10 ticks (unless locked by manual shock)
        let prev_regime = self.regime;
        if self.regime_lock_ticks > 0 {
            self.regime_lock_ticks -= 1;
        } else if tick % 10 == 0 {
            let row_idx = Self::regime_index(self.regime);
            let roll: u32 = rng.gen_range(0..1000);
            let row = TRANSITION_MATRIX_PER_MILLE[row_idx];
            let next_idx = if roll < row[0] {
                0
            } else if roll < row[0] + row[1] {
                1
            } else if roll < row[0] + row[1] + row[2] {
                2
            } else {
                3
            };
            self.regime = Self::index_to_regime(next_idx);
        }

        let regime_changed = self.regime != prev_regime;
        if regime_changed {
            self.total_regime_shifts += 1;
            self.last_headline = Self::headline_for_regime(self.regime, tick);
        }

        // 3. Self-exciting Hawkes arrival check based on current intensity and regime
        let arrival_prob_per_mille = match self.regime {
            MarketRegime::Calm => 15u32,
            MarketRegime::Trending => 45u32,
            MarketRegime::LiquidityDrought => 140u32,
            MarketRegime::FlashCrash => 360u32,
        };
        if rng.gen_range(0..1000) < arrival_prob_per_mille {
            self.hawkes_excitation_pips = self.hawkes_excitation_pips.saturating_add(HAWKES_ALPHA);
        }

        // 4. Update Ornstein-Uhlenbeck + Jump-Diffusion fundamental price in integer pips
        let mean_diff_pips = self.ou_mean_price.0 - self.fundamental_value.0;
        let pull_pips = mean_diff_pips / 200; // mean reversion pull

        let (drift_bps, vol_bps, jump_bps) = match self.regime {
            MarketRegime::Calm => (0i64, 2i64, 0i64),
            MarketRegime::Trending => (1i64, 4i64, 0i64),
            MarketRegime::LiquidityDrought => (-1i64, 7i64, -8i64),
            MarketRegime::FlashCrash => (-4i64, 14i64, -22i64),
        };

        let noise_step: i64 = rng.gen_range(-vol_bps..=vol_bps);
        let jump_step: i64 = if self.regime.is_ood() && rng.gen_range(0..100) < 18 {
            jump_bps
        } else {
            0
        };

        let total_bps_delta = drift_bps + noise_step + jump_step;
        let price_after_bps = self.fundamental_value.apply_bps(total_bps_delta);
        let next_pips = price_after_bps
            .0
            .saturating_add(pull_pips)
            .clamp(500 * SCALE, 10_000 * SCALE);
        self.fundamental_value = FixedPrice(next_pips);

        (self.regime, regime_changed)
    }

    /// Computes Kyle non-linear square-root market impact in basis points:
    /// $\Delta P_t = \eta \cdot \text{sign}(q_t) \cdot \sigma_t (|q_t| / V_t)^{0.5}$
    pub fn kyle_impact_bps(&self, signed_qty_pips: i64, book_depth_pips: i64) -> i64 {
        if signed_qty_pips == 0 || book_depth_pips <= 0 {
            return 0;
        }
        let sign = if signed_qty_pips >= 0 { 1i64 } else { -1i64 };
        let ratio_scaled: u128 = ((signed_qty_pips.unsigned_abs() as u128) * 10_000u128)
            / (book_depth_pips.unsigned_abs().max(1) as u128);
        let sqrt_ratio = ratio_scaled.isqrt() as i64; // 0..100 for ratio 0..1
        let sigma_mult = match self.regime {
            MarketRegime::Calm => 1,
            MarketRegime::Trending => 2,
            MarketRegime::LiquidityDrought => 4,
            MarketRegime::FlashCrash => 7,
        };
        sign * ((sqrt_ratio * sigma_mult) / 10).clamp(1, 250)
    }

    pub fn feed_hash(&self, hasher: &mut Sha256) {
        hasher.update([Self::regime_index(self.regime) as u8]);
        hasher.update(self.hawkes_excitation_pips.to_le_bytes());
        hasher.update(self.fundamental_value.0.to_le_bytes());
        hasher.update(self.ou_mean_price.0.to_le_bytes());
        hasher.update(self.regime_lock_ticks.to_le_bytes());
        hasher.update(self.total_regime_shifts.to_le_bytes());
    }

    const fn regime_index(regime: MarketRegime) -> usize {
        match regime {
            MarketRegime::Calm => 0,
            MarketRegime::Trending => 1,
            MarketRegime::LiquidityDrought => 2,
            MarketRegime::FlashCrash => 3,
        }
    }

    const fn index_to_regime(idx: usize) -> MarketRegime {
        match idx {
            0 => MarketRegime::Calm,
            1 => MarketRegime::Trending,
            2 => MarketRegime::LiquidityDrought,
            _ => MarketRegime::FlashCrash,
        }
    }

    fn headline_for_regime(regime: MarketRegime, tick: u64) -> String {
        match regime {
            MarketRegime::Calm => format!(
                "[WIRE @ T+{}] Institutional order flow balanced; L2 spreads anchored near 8-15 bps.",
                tick
            ),
            MarketRegime::Trending => format!(
                "[WIRE @ T+{}] Directional macro flow detected across spot CLOB and on-chain CFMM pools.",
                tick
            ),
            MarketRegime::LiquidityDrought => format!(
                "[HAZARD @ T+{}] Top-of-book depth thinning; Hawkes intensity rising — makers widening quotes.",
                tick
            ),
            MarketRegime::FlashCrash => format!(
                "[ALERT @ T+{}] FLASH CRASH CASCADE: Emergency rate shock & DeFi collateral liquidation wave!",
                tick
            ),
        }
    }
}
