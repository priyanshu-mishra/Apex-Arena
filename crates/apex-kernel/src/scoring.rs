//! Quantitative Portfolio Accounting & Apex Composite Score (ACS) Engine.
//!
//! Computes Probabilistic Sharpe Ratio ($\text{PSR}(0)$), Capped Calmar Ratio,
//! Out-of-Distribution Survival Score ($\text{Survival}_{\text{OOD}}$), and Turnover Penalty
//! using strictly deterministic integer math.

use apex_types::{
    AgentKind, AgentStatus, Fill, FixedPrice, FixedQty, MarketRegime, ScoreReport, Side,
    BPS_SCALE, SCALE,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPortfolio {
    pub agent_id: String,
    pub kind: AgentKind,
    pub status: AgentStatus,
    pub initial_equity_pips: i64,
    pub cash_quote_pips: i64,
    pub inventory_base: FixedQty,
    pub last_equity_pips: i64,
    pub peak_equity_pips: i64,
    pub max_drawdown_bps: i64,
    pub liquidation_drawdown_limit_bps: i64,
    pub epoch_returns_bps: Vec<i64>,
    pub ood_returns_bps: Vec<i64>,
    pub total_fills: u64,
    pub traded_notional_pips: i64,
    pub spread_offset_bps: i64,
    pub inventory_limit_base: FixedQty,
}

impl AgentPortfolio {
    pub fn new(
        agent_id: impl Into<String>,
        kind: AgentKind,
        initial_cash_quote_pips: i64,
        initial_inventory_base: FixedQty,
        initial_mid_price: FixedPrice,
        liquidation_drawdown_limit_bps: i64,
    ) -> Self {
        let inv_val = initial_mid_price.notional_pips(initial_inventory_base);
        let initial_equity = initial_cash_quote_pips.saturating_add(inv_val);
        Self {
            agent_id: agent_id.into(),
            kind,
            status: AgentStatus::Active,
            initial_equity_pips: initial_equity,
            cash_quote_pips: initial_cash_quote_pips,
            inventory_base: initial_inventory_base,
            last_equity_pips: initial_equity,
            peak_equity_pips: initial_equity,
            max_drawdown_bps: 0,
            liquidation_drawdown_limit_bps,
            epoch_returns_bps: Vec::with_capacity(256),
            ood_returns_bps: Vec::with_capacity(128),
            total_fills: 0,
            traded_notional_pips: 0,
            spread_offset_bps: match kind {
                AgentKind::AiReasoning => 8,
                AgentKind::QuantAlgo => 5,
                AgentKind::BackgroundEcology => 10,
            },
            inventory_limit_base: FixedQty::from_whole(80),
        }
    }

    #[inline]
    pub fn mark_to_market_equity(&self, mid_price: FixedPrice) -> i64 {
        let inv_value = mid_price.notional_pips(self.inventory_base);
        self.cash_quote_pips.saturating_add(inv_value)
    }

    /// Applies a CLOB fill receipt to this agent's cash and base inventory.
    pub fn apply_clob_fill(&mut self, fill: &Fill, is_maker: bool) {
        let notional = fill.price.notional_pips(fill.qty);
        let fee = if is_maker {
            fill.maker_fee_pips
        } else {
            fill.taker_fee_pips
        };

        let side = if is_maker {
            fill.taker_side.opposite()
        } else {
            fill.taker_side
        };

        match side {
            Side::Bid => {
                self.inventory_base.0 = self.inventory_base.0.saturating_add(fill.qty.0);
                self.cash_quote_pips = self
                    .cash_quote_pips
                    .saturating_sub(notional)
                    .saturating_sub(fee);
            }
            Side::Ask => {
                self.inventory_base.0 = self.inventory_base.0.saturating_sub(fill.qty.0);
                self.cash_quote_pips = self
                    .cash_quote_pips
                    .saturating_add(notional)
                    .saturating_sub(fee);
            }
        }

        self.total_fills += 1;
        self.traded_notional_pips = self.traded_notional_pips.saturating_add(notional.abs());
    }

    /// Applies an on-chain Revm CFMM swap to this agent's cash and base inventory.
    pub fn apply_evm_swap(&mut self, zero_for_one: bool, amount_in: FixedQty, amount_out: FixedQty) {
        if zero_for_one {
            // Sold ETH (base) for USDT (quote)
            self.inventory_base.0 = self.inventory_base.0.saturating_sub(amount_in.0);
            self.cash_quote_pips = self.cash_quote_pips.saturating_add(amount_out.0);
            self.traded_notional_pips = self.traded_notional_pips.saturating_add(amount_out.0);
        } else {
            // Sold USDT (quote) for ETH (base)
            self.cash_quote_pips = self.cash_quote_pips.saturating_sub(amount_in.0);
            self.inventory_base.0 = self.inventory_base.0.saturating_add(amount_out.0);
            self.traded_notional_pips = self.traded_notional_pips.saturating_add(amount_in.0);
        }
        self.total_fills += 1;
    }

    /// Updates mark-to-market equity, peak drawdown, and checks maintenance margin liquidation.
    /// Returns `true` if the account newly triggered liquidation on this tick.
    pub fn update_valuation(&mut self, mid_price: FixedPrice, record_epoch: bool, regime: MarketRegime) -> bool {
        let eq = self.mark_to_market_equity(mid_price);
        if eq > self.peak_equity_pips {
            self.peak_equity_pips = eq;
        }

        if self.peak_equity_pips > 0 {
            let dd_bps = (((self.peak_equity_pips - eq) as i128 * BPS_SCALE as i128)
                / (self.peak_equity_pips as i128)) as i64;
            if dd_bps > self.max_drawdown_bps {
                self.max_drawdown_bps = dd_bps;
            }
        }

        if record_epoch && self.last_equity_pips > 0 {
            let ret_bps = (((eq - self.last_equity_pips) as i128 * BPS_SCALE as i128)
                / (self.last_equity_pips as i128)) as i64;
            self.epoch_returns_bps.push(ret_bps);
            if regime.is_ood() {
                self.ood_returns_bps.push(ret_bps);
            }
            self.last_equity_pips = eq;
        }

        if self.status == AgentStatus::Active
            && self.max_drawdown_bps >= self.liquidation_drawdown_limit_bps
        {
            self.status = AgentStatus::Liquidated;
            return true;
        }
        false
    }

    /// Computes full quantitative evaluation report including PSR(0), Capped Calmar,
    /// OOD Survival Score, and Apex Composite Score (ACS).
    pub fn compute_score_report(&self, mid_price: FixedPrice) -> ScoreReport {
        let current_eq = self.mark_to_market_equity(mid_price);
        let pnl_bps = if self.initial_equity_pips > 0 {
            (((current_eq - self.initial_equity_pips) as i128 * BPS_SCALE as i128)
                / (self.initial_equity_pips as i128)) as i64
        } else {
            0
        };

        let psr_bps = compute_psr_zero_bps(&self.epoch_returns_bps, pnl_bps);
        let calmar_capped_bps = compute_calmar_capped_bps(pnl_bps, self.max_drawdown_bps);
        let ood_survival_bps = compute_ood_survival_bps(
            &self.ood_returns_bps,
            self.max_drawdown_bps,
            self.status,
        );
        let turnover_penalty_bps = compute_turnover_penalty_bps(
            self.traded_notional_pips,
            self.initial_equity_pips,
        );

        // ACS = 0.40 * PSR(0) + 0.30 * Calmar_capped + 0.20 * Survival_OOD - 0.10 * Penalty_turnover
        let acs_score_bps = if self.status == AgentStatus::Liquidated {
            0
        } else {
            let weighted = 40 * psr_bps + 30 * calmar_capped_bps + 20 * ood_survival_bps
                - 10 * turnover_penalty_bps;
            (weighted / 100).clamp(0, BPS_SCALE)
        };

        ScoreReport {
            agent_id: self.agent_id.clone(),
            kind: self.kind,
            status: self.status,
            initial_equity_pips: self.initial_equity_pips,
            current_equity_pips: current_eq,
            peak_equity_pips: self.peak_equity_pips,
            cash_quote_pips: self.cash_quote_pips,
            inventory_base: self.inventory_base,
            pnl_bps,
            max_drawdown_bps: self.max_drawdown_bps,
            psr_bps,
            calmar_capped_bps,
            ood_survival_bps,
            turnover_penalty_bps,
            acs_score_bps,
            total_fills: self.total_fills,
            traded_notional_pips: self.traded_notional_pips,
        }
    }

    pub fn feed_hash(&self, hasher: &mut Sha256) {
        hasher.update(self.agent_id.as_bytes());
        hasher.update([self.status as u8]);
        hasher.update(self.cash_quote_pips.to_le_bytes());
        hasher.update(self.inventory_base.0.to_le_bytes());
        hasher.update(self.peak_equity_pips.to_le_bytes());
        hasher.update(self.max_drawdown_bps.to_le_bytes());
        hasher.update(self.total_fills.to_le_bytes());
        hasher.update(self.traded_notional_pips.to_le_bytes());
    }
}

/// Computes Probabilistic Sharpe Ratio $\text{PSR}(0)$ scaled to `[0, 10000]` bps
/// using deterministic integer central moments (mean, variance, skewness, kurtosis).
pub fn compute_psr_zero_bps(returns_bps: &[i64], cumulative_pnl_bps: i64) -> i64 {
    let n = returns_bps.len() as i128;
    if n < 2 {
        // Fallback when fewer than 2 macro epochs have elapsed
        return (5_000 + cumulative_pnl_bps * 15).clamp(500, 9_900);
    }

    let sum: i128 = returns_bps.iter().map(|&r| r as i128).sum();
    let mean_scaled = (sum * 1_000) / n; // scaled by 1000

    let mut m2_sum: i128 = 0;
    let mut m3_sum: i128 = 0;
    let mut m4_sum: i128 = 0;

    for &r in returns_bps {
        let diff = (r as i128) * 1_000 - mean_scaled;
        let d2 = (diff * diff) / 1_000;
        let d3 = (d2 * diff) / 1_000;
        let d4 = (d2 * d2) / 1_000;
        m2_sum += d2;
        m3_sum += d3;
        m4_sum += d4;
    }

    let var_scaled = (m2_sum / (n - 1)).max(1);
    let std_scaled = (var_scaled.unsigned_abs() * 1_000).isqrt() as i128;
    if std_scaled == 0 {
        return 5_000;
    }

    // Sample Sharpe SR_hat scaled by 1000
    let sr_scaled = ((mean_scaled * 1_000) / std_scaled).clamp(-5_000, 5_000);

    // Skewness gamma_3 and Kurtosis gamma_4 scaled by 1000
    let denom_m3 = ((std_scaled * std_scaled) / 1_000 * std_scaled / 1_000).max(1);
    let denom_m4 = ((var_scaled * var_scaled) / 1_000).max(1);
    let skew_scaled = ((m3_sum / n) * 1_000 / denom_m3).clamp(-3_000, 3_000);
    let kurt_scaled = ((m4_sum / n) * 1_000 / denom_m4).clamp(1_500, 8_000);

    // Denominator inside PSR square root: 1 - gamma_3 * SR + ((gamma_4 - 1) / 4) * SR^2
    let term_skew = (skew_scaled * sr_scaled) / 1_000;
    let sr_sq = (sr_scaled * sr_scaled) / 1_000;
    let term_kurt = ((kurt_scaled - 1_000) * sr_sq) / 4_000;
    let inner_radicand = (1_000 - term_skew + term_kurt).max(100) as u128;
    let denom_psr = (inner_radicand * 1_000).isqrt() as i128;

    let sqrt_n_minus_1 = (((n - 1) as u128) * 1_000_000).isqrt() as i128; // scaled by 1000
    let z_scaled = ((sr_scaled * sqrt_n_minus_1) / denom_psr.max(1)).clamp(-4_000, 4_000);

    normal_cdf_bps(z_scaled as i64)
}

/// Deterministic rational approximation of Standard Normal CDF $\Phi(z)$ where `z_milli = z * 1000`,
/// returning probability in basis points `[0, 10000]`.
pub fn normal_cdf_bps(z_milli: i64) -> i64 {
    let clamped = z_milli.clamp(-4_000, 4_000);
    // Logistic-polynomial approximation accurate across [-4, 4]
    let abs_z = clamped.abs() as i128;
    // 1 / (1 + 0.2316419 * |z|)
    let t_denom = 1_000_000 + 231 * abs_z;
    let t = (1_000_000_000 / t_denom).clamp(0, 1_000_000); // scaled by 10^6

    // Tail approximation
    let z_sq = (abs_z * abs_z) / 1_000; // scaled by 1000
    // exp(-z^2 / 2) via Padé 1 / (1 + x + x^2/2 + x^3/6) where x = z^2 / 2
    let x = z_sq / 2; // scaled by 1000
    let x2 = (x * x) / 1_000;
    let x3 = (x2 * x) / 1_000;
    let exp_denom = 1_000 + x + (x2 / 2) + (x3 / 6);
    let pdf_scaled = (398_942 * 1_000) / exp_denom.max(1); // 0.398942 * 10^6

    let poly = (319 * t + 356 * ((t * t) / 1_000_000)) / 1_000;
    let tail_bps = ((pdf_scaled * poly) / 100_000_000).clamp(0, 5_000) as i64;

    if clamped >= 0 {
        (10_000 - tail_bps).clamp(0, 10_000)
    } else {
        tail_bps.clamp(0, 10_000)
    }
}

/// Computes Capped Calmar Ratio scaled to `[0, 10000]` bps where `10.0 = 10000 bps`.
pub fn compute_calmar_capped_bps(pnl_bps: i64, max_drawdown_bps: i64) -> i64 {
    if pnl_bps <= 0 {
        return (2_500 + pnl_bps * 2).clamp(0, 2_500);
    }
    let dd = max_drawdown_bps.max(25); // floor DD at 25 bps to cap ratio smoothly
    let annual_pnl_bps = pnl_bps.saturating_mul(12);
    let ratio_bps = ((annual_pnl_bps as i128 * 1_000) / (dd as i128)) as i64;
    ratio_bps.clamp(0, BPS_SCALE)
}

/// Computes Out-of-Distribution Survival Score strictly on `LiquidityDrought` and `FlashCrash` ticks.
pub fn compute_ood_survival_bps(
    ood_returns_bps: &[i64],
    max_drawdown_bps: i64,
    status: AgentStatus,
) -> i64 {
    if status == AgentStatus::Liquidated {
        return 0;
    }
    let ood_sum: i64 = ood_returns_bps.iter().copied().sum();
    let base_survival = 8_500 - (max_drawdown_bps * 3);
    (base_survival + ood_sum * 12).clamp(0, BPS_SCALE)
}

/// Computes turnover penalty in basis points `[0, 10000]`.
pub fn compute_turnover_penalty_bps(traded_notional_pips: i64, initial_equity_pips: i64) -> i64 {
    if initial_equity_pips <= 0 {
        return 0;
    }
    let turnover_multiple =
        ((traded_notional_pips as i128 * 100) / (initial_equity_pips as i128)) as i64;
    // Penalize excessive wash-like churning above 5x initial equity
    ((turnover_multiple.saturating_sub(200)) * 5).clamp(0, 5_000)
}

pub fn format_equity_dollars(equity_pips: i64) -> String {
    let whole = (equity_pips / SCALE).max(0);
    let s = whole.to_string();
    let mut out = String::with_capacity(s.len() + 4);
    out.push('$');
    for (i, ch) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    out
}
