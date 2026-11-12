//! Foundational fixed-point arithmetic primitives and deterministic schemas for ApexArena.
//!
//! All state quantities and prices use 64-bit signed fixed-point representation scaled by `10^8`.
//! Intermediate products use 128-bit signed integers (`i128`) to prevent overflow while
//! guaranteeing bit-for-bit determinism across x86_64 and aarch64 platforms.

use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;

/// Fixed-point scaling factor: `10^8` pips per 1.00000000 unit.
pub const SCALE: i64 = 100_000_000;

/// Basis points denominator (`10,000 bps = 100%`).
pub const BPS_SCALE: i64 = 10_000;

/// Fast microstructure loop duration in nanoseconds (`10ms = 10,000,000ns`).
pub const FAST_TICK_NS: u64 = 10_000_000;

/// Number of fast microstructure ticks per slow macro LLM barrier epoch (`100 * 10ms = 1000ms`).
pub const MACRO_EPOCH_TICKS: u64 = 100;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum FixedMathError {
    #[error("fixed-point arithmetic overflow")]
    Overflow,
    #[error("division by zero in fixed-point operation")]
    DivisionByZero,
    #[error("invalid order parameters: {0}")]
    InvalidOrder(&'static str),
}

/// Signed 64-bit fixed-point price (`1.00 = 100_000_000` pips).
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default, Serialize, Deserialize,
)]
pub struct FixedPrice(pub i64);

impl FixedPrice {
    pub const ZERO: Self = Self(0);

    #[inline]
    pub const fn from_pips(pips: i64) -> Self {
        Self(pips)
    }

    #[inline]
    pub const fn from_whole(units: i64) -> Self {
        Self(units * SCALE)
    }

    #[inline]
    pub const fn from_cents(cents: i64) -> Self {
        Self(cents * (SCALE / 100))
    }

    #[inline]
    pub const fn pips(self) -> i64 {
        self.0
    }

    #[inline]
    pub fn checked_add(self, rhs: Self) -> Result<Self, FixedMathError> {
        self.0
            .checked_add(rhs.0)
            .map(Self)
            .ok_or(FixedMathError::Overflow)
    }

    #[inline]
    pub fn checked_sub(self, rhs: Self) -> Result<Self, FixedMathError> {
        self.0
            .checked_sub(rhs.0)
            .map(Self)
            .ok_or(FixedMathError::Overflow)
    }

    #[inline]
    pub const fn saturating_add(self, rhs: Self) -> Self {
        Self(self.0.saturating_add(rhs.0))
    }

    #[inline]
    pub const fn saturating_sub(self, rhs: Self) -> Self {
        Self(self.0.saturating_sub(rhs.0))
    }

    /// Applies a basis-point offset (`bps` out of `10,000`) to this price using `i128` intermediate math.
    #[inline]
    pub const fn apply_bps(self, bps: i64) -> Self {
        let num = (self.0 as i128) * ((BPS_SCALE + bps) as i128);
        Self((num / (BPS_SCALE as i128)) as i64)
    }

    /// Computes exact midpoint between two prices using `i128` to prevent overflow.
    #[inline]
    pub const fn midpoint(self, other: Self) -> Self {
        let sum = (self.0 as i128) + (other.0 as i128);
        Self((sum / 2) as i64)
    }

    /// Computes spread in basis points relative to the midpoint of `bid` and `ask`.
    #[inline]
    pub const fn spread_bps(bid: Self, ask: Self) -> i64 {
        if bid.0 <= 0 || ask.0 < bid.0 {
            return 0;
        }
        let mid = Self::midpoint(bid, ask).0 as i128;
        if mid == 0 {
            return 0;
        }
        let diff = (ask.0 - bid.0) as i128;
        ((diff * (BPS_SCALE as i128) + (mid / 2)) / mid) as i64
    }

    /// Computes signed basis-point difference `(other - self) / self * 10,000`.
    #[inline]
    pub const fn bps_diff(self, other: Self) -> i64 {
        if self.0 == 0 {
            return 0;
        }
        let diff = (other.0 - self.0) as i128;
        ((diff * (BPS_SCALE as i128)) / (self.0 as i128)) as i64
    }

    /// Computes notional value `(Price * Qty) / SCALE` in quote pips using `i128` intermediate product.
    #[inline]
    pub fn checked_notional(self, qty: FixedQty) -> Result<i64, FixedMathError> {
        let prod = (self.0 as i128)
            .checked_mul(qty.0 as i128)
            .ok_or(FixedMathError::Overflow)?;
        let scaled = prod / (SCALE as i128);
        i64::try_from(scaled).map_err(|_| FixedMathError::Overflow)
    }

    /// Infallible saturating notional value `(Price * Qty) / SCALE` in quote pips.
    #[inline]
    pub const fn notional_pips(self, qty: FixedQty) -> i64 {
        let prod = (self.0 as i128) * (qty.0 as i128);
        (prod / (SCALE as i128)) as i64
    }

    /// Formats price as `$X,XXX.XX` using pure integer arithmetic.
    pub fn format_dollars(self) -> String {
        let sign = if self.0 < 0 { "-" } else { "" };
        let abs_val = self.0.unsigned_abs();
        let whole = abs_val / (SCALE as u64);
        let cents = (abs_val % (SCALE as u64)) / ((SCALE as u64) / 100);
        format!("{}${}.{:02}", sign, whole, cents)
    }
}

impl fmt::Display for FixedPrice {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.format_dollars())
    }
}

/// Signed 64-bit fixed-point quantity (`1.00000000 = 100_000_000` pips).
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default, Serialize, Deserialize,
)]
pub struct FixedQty(pub i64);

impl FixedQty {
    pub const ZERO: Self = Self(0);

    #[inline]
    pub const fn from_pips(pips: i64) -> Self {
        Self(pips)
    }

    #[inline]
    pub const fn from_whole(units: i64) -> Self {
        Self(units * SCALE)
    }

    #[inline]
    pub const fn from_milli(milli: i64) -> Self {
        Self(milli * (SCALE / 1_000))
    }

    #[inline]
    pub const fn pips(self) -> i64 {
        self.0
    }

    #[inline]
    pub const fn is_zero(self) -> bool {
        self.0 == 0
    }

    #[inline]
    pub fn checked_add(self, rhs: Self) -> Result<Self, FixedMathError> {
        self.0
            .checked_add(rhs.0)
            .map(Self)
            .ok_or(FixedMathError::Overflow)
    }

    #[inline]
    pub fn checked_sub(self, rhs: Self) -> Result<Self, FixedMathError> {
        self.0
            .checked_sub(rhs.0)
            .map(Self)
            .ok_or(FixedMathError::Overflow)
    }

    #[inline]
    pub const fn saturating_add(self, rhs: Self) -> Self {
        Self(self.0.saturating_add(rhs.0))
    }

    #[inline]
    pub const fn saturating_sub(self, rhs: Self) -> Self {
        Self(self.0.saturating_sub(rhs.0))
    }

    #[inline]
    pub const fn abs(self) -> Self {
        Self(self.0.saturating_abs())
    }

    #[inline]
    pub const fn mul_bps(self, bps: i64) -> Self {
        let prod = (self.0 as i128) * (bps as i128);
        Self((prod / (BPS_SCALE as i128)) as i64)
    }

    pub fn format_2dp(self) -> String {
        let sign = if self.0 < 0 { "-" } else { "" };
        let abs_val = self.0.unsigned_abs();
        let whole = abs_val / (SCALE as u64);
        let frac = (abs_val % (SCALE as u64)) / ((SCALE as u64) / 100);
        format!("{}{}.{:02}", sign, whole, frac)
    }
}

impl fmt::Display for FixedQty {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.format_2dp())
    }
}

/// Order side on the Central Limit Order Book.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Side {
    Bid,
    Ask,
}

impl Side {
    #[inline]
    pub const fn opposite(self) -> Self {
        match self {
            Side::Bid => Side::Ask,
            Side::Ask => Side::Bid,
        }
    }

    #[inline]
    pub const fn as_str(self) -> &'static str {
        match self {
            Side::Bid => "BID",
            Side::Ask => "ASK",
        }
    }
}

/// Supported order execution types on the L3 matching engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum OrderType {
    /// Standard limit order: matches crossing liquidity up to limit price and rests remainder.
    Limit,
    /// Market order: sweeps opposing liquidity at any available price and cancels unfilled remainder.
    Market,
    /// Post-Only maker order: rejected immediately if it would cross the opposing best price.
    PostOnly,
    /// Immediate-Or-Cancel: matches crossing liquidity up to limit price and cancels remainder.
    IOC,
}

/// Unique monotonically increasing order identifier.
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default, Serialize, Deserialize,
)]
pub struct OrderId(pub u64);

/// L3 Order entry stored in the matching engine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Order {
    pub id: OrderId,
    pub agent_id: String,
    pub side: Side,
    pub order_type: OrderType,
    pub price: FixedPrice,
    pub original_qty: FixedQty,
    pub remaining_qty: FixedQty,
    pub virtual_ts_ns: u64,
}

/// Execution fill receipt generated when a taker order matches a resting maker order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Fill {
    pub maker_order_id: OrderId,
    pub taker_order_id: OrderId,
    pub maker_agent_id: String,
    pub taker_agent_id: String,
    pub price: FixedPrice,
    pub qty: FixedQty,
    pub taker_side: Side,
    pub maker_fee_pips: i64,
    pub taker_fee_pips: i64,
    pub virtual_ts_ns: u64,
}

/// Outcome returned when submitting an order to the L3 CLOB.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MatchOutcome {
    pub order_id: OrderId,
    pub fills: Vec<Fill>,
    pub rested_qty: FixedQty,
    pub canceled_qty: FixedQty,
    pub self_trade_prevented: bool,
    pub post_only_rejected: bool,
}

/// Aggregated L2 price level for depth ladder rendering.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct L2Level {
    pub price: FixedPrice,
    pub total_qty: FixedQty,
    pub order_count: usize,
}

/// Snapshot of top-of-book L2 depth.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BookSnapshot {
    pub bids: Vec<L2Level>,
    pub asks: Vec<L2Level>,
    pub best_bid: Option<FixedPrice>,
    pub best_ask: Option<FixedPrice>,
    pub mid_price: FixedPrice,
    pub spread_bps: i64,
}

/// Discrete Markov-switching market regimes in the Adversarial Chaos Engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum MarketRegime {
    Calm,
    Trending,
    LiquidityDrought,
    FlashCrash,
}

impl MarketRegime {
    #[inline]
    pub const fn as_str(self) -> &'static str {
        match self {
            MarketRegime::Calm => "CALM",
            MarketRegime::Trending => "TRENDING",
            MarketRegime::LiquidityDrought => "LIQUIDITY DROUGHT",
            MarketRegime::FlashCrash => "FLASH CRASH",
        }
    }

    /// Returns true if the regime is an Out-of-Distribution (OOD) stress state.
    #[inline]
    pub const fn is_ood(self) -> bool {
        matches!(
            self,
            MarketRegime::LiquidityDrought | MarketRegime::FlashCrash
        )
    }
}

impl fmt::Display for MarketRegime {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Structured trace event emitted by the embedded Bluealloy Revm sandbox.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvmTraceEvent {
    pub block_number: u64,
    pub virtual_ts_ns: u64,
    pub tx_hash: String,
    pub caller: String,
    pub contract_address: String,
    pub action: String,
    pub zero_for_one: bool,
    pub amount_in: FixedQty,
    pub amount_out: FixedQty,
    pub effective_price: FixedPrice,
    pub slippage_bps: i64,
    pub reserve_base: FixedQty,
    pub reserve_quote: FixedQty,
    pub gas_used: u64,
    pub log_line: String,
}

/// Classification of arena market participants.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum AgentKind {
    /// Autonomous LLM / Neuro-symbolic macro-barrier reasoning agent (`[AI]`).
    AiReasoning,
    /// High-frequency / quantitative algorithmic strategy (`[QT]`).
    QuantAlgo,
    /// Stylized ABIDES market ecology agent (`[ECO]`).
    BackgroundEcology,
}

impl AgentKind {
    #[inline]
    pub const fn badge(self) -> &'static str {
        match self {
            AgentKind::AiReasoning => "[AI]",
            AgentKind::QuantAlgo => "[QT]",
            AgentKind::BackgroundEcology => "[ECO]",
        }
    }
}

/// Operational status of an agent's margin account.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum AgentStatus {
    Active,
    Liquidated,
}

impl AgentStatus {
    #[inline]
    pub const fn as_str(self) -> &'static str {
        match self {
            AgentStatus::Active => "ACT",
            AgentStatus::Liquidated => "LIQ",
        }
    }
}

/// Deterministic reasoning trace emitted at the slow macro barrier (1000ms epochs).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentReasoningTrace {
    pub tick: u64,
    pub virtual_ts_ns: u64,
    pub agent_id: String,
    pub regime: MarketRegime,
    pub thought_summary: String,
    pub tool_action: String,
    pub target_spread_bps: i64,
    pub inventory_skew_bps: i64,
}

/// Aggregated market context digest dispatched at the 1000ms Slow Macro Epoch Barrier.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MacroDigest {
    pub epoch_index: u64,
    pub tick: u64,
    pub virtual_ts_ns: u64,
    pub block_number: u64,
    pub regime: MarketRegime,
    pub clob_mid_price: FixedPrice,
    pub evm_spot_price: FixedPrice,
    pub spread_bps: i64,
    pub order_book_imbalance_bps: i64,
    pub realized_vol_bps: i64,
    pub hawkes_intensity_pips: i64,
    pub news_headline: String,
}

/// Quantitative benchmark evaluation metrics and Apex Composite Score (ACS) in basis points.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScoreReport {
    pub agent_id: String,
    pub kind: AgentKind,
    pub status: AgentStatus,
    pub initial_equity_pips: i64,
    pub current_equity_pips: i64,
    pub peak_equity_pips: i64,
    pub cash_quote_pips: i64,
    pub inventory_base: FixedQty,
    pub pnl_bps: i64,
    pub max_drawdown_bps: i64,
    pub psr_bps: i64,
    pub calmar_capped_bps: i64,
    pub ood_survival_bps: i64,
    pub turnover_penalty_bps: i64,
    /// Apex Composite Score scaled to `0..=10,000` (100.00 = 10,000 bps). Disqualified (`LIQ`) = 0.
    pub acs_score_bps: i64,
    pub total_fills: u64,
    pub traded_notional_pips: i64,
}

/// Complete telemetry frame for TUI and Web Arena rendering.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TickTelemetry {
    pub tick: u64,
    pub virtual_ts_ns: u64,
    pub block_number: u64,
    pub regime: MarketRegime,
    pub hawkes_intensity_pips: i64,
    pub clob_mid_price: FixedPrice,
    pub evm_spot_price: FixedPrice,
    pub spread_bps: i64,
    pub book: BookSnapshot,
    pub evm_reserve_base: FixedQty,
    pub evm_reserve_quote: FixedQty,
    pub recent_evm_events: Vec<EvmTraceEvent>,
    pub recent_reasoning: Vec<AgentReasoningTrace>,
    pub leaderboard: Vec<ScoreReport>,
    pub state_hash: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fixed_point_notional_and_formatting() {
        let price = FixedPrice::from_cents(224_150); // $2241.50
        let qty = FixedQty::from_milli(4_500); // 4.50 ETH
        assert_eq!(price.format_dollars(), "$2241.50");
        assert_eq!(qty.format_2dp(), "4.50");

        let notional = price.checked_notional(qty).unwrap();
        // 2241.50 * 4.50 = 10086.75 -> 10086.75 * 10^8 pips
        assert_eq!(notional, 1_008_675 * (SCALE / 100));
    }

    #[test]
    fn test_spread_bps_calculation() {
        let bid = FixedPrice::from_cents(224_000); // $2240.00
        let ask = FixedPrice::from_cents(224_336); // $2243.36
        let spread = FixedPrice::spread_bps(bid, ask);
        assert_eq!(spread, 15);
    }
}
