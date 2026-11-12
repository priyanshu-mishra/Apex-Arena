//! ApexArena Hexagonal Deterministic Kernel (`apex-kernel`).
//!
//! Coordinates the Dual-Speed Synchronization Barrier Clock (10ms fast microstructure ticks
//! and 1000ms slow macro LLM barrier epochs), L3 CLOB matching engine, embedded Revm AMM pool,
//! Markov-switching Hawkes chaos engine, ABIDES ecology, and SHA-256 state verification.

pub mod chaos;
pub mod ecology;
pub mod scoring;

use apex_clob::OrderBook;
use apex_evm::{EvmAmmPool, SwapReceipt};
use apex_types::{
    AgentKind, AgentReasoningTrace, AgentStatus, BookSnapshot, FixedMathError, FixedPrice,
    FixedQty, MacroDigest, MarketRegime, MatchOutcome, OrderId, OrderType, ScoreReport, Side,
    TickTelemetry, FAST_TICK_NS, MACRO_EPOCH_TICKS, SCALE,
};
use chaos::ChaosEngine;
use ecology::{evaluate_macro_epoch_barrier, generate_fast_tick_actions, AgentAction};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use scoring::AgentPortfolio;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, VecDeque};

const MAX_REASONING_TRACES: usize = 64;

pub struct ArenaKernel {
    seed: u64,
    rng: ChaCha8Rng,
    tick: u64,
    virtual_ts_ns: u64,
    epoch_index: u64,
    clob: OrderBook,
    evm_pool: EvmAmmPool,
    chaos: ChaosEngine,
    portfolios: BTreeMap<String, AgentPortfolio>,
    reasoning_traces: VecDeque<AgentReasoningTrace>,
    gemini_spread_bps: i64,
    deepseek_spread_bps: i64,
    price_history: VecDeque<(u64, FixedPrice, FixedPrice, MarketRegime)>,
}

impl ArenaKernel {
    /// Creates a new deterministic `ArenaKernel` seeded with `seed` and `initial_regime`.
    pub fn new(seed: u64, initial_regime: MarketRegime) -> Self {
        let rng = ChaCha8Rng::seed_from_u64(seed);
        let initial_price = FixedPrice::from_cents(224_150); // $2,241.50
        let clob = OrderBook::new("ETH-USDT", initial_price);

        // Initialize Revm pool with 1,000 ETH and 2,241,500 USDT ($2,241.50 spot) at block #1,942,000
        let evm_pool = EvmAmmPool::new(
            FixedQty::from_whole(1_000),
            FixedQty::from_whole(2_241_500),
            1_942_000,
        );

        let chaos = ChaosEngine::new(initial_regime, initial_price);
        let mut portfolios = BTreeMap::new();

        // Register the 4 headline benchmark competitors from the workstation specification
        // 1. [AI] Gemini-2.5: starts with defensive short-biased hedge so it gains alpha during OOD shocks
        portfolios.insert(
            "Gemini-2.5".to_string(),
            AgentPortfolio::new(
                "Gemini-2.5",
                AgentKind::AiReasoning,
                840_000 * SCALE,
                FixedQty::from_whole(-52),
                initial_price,
                2_500, // 25% max drawdown limit
            ),
        );

        // 2. [AI] DeepSeek-R1: starts with moderate defensive hedge
        portfolios.insert(
            "DeepSeek-R1".to_string(),
            AgentPortfolio::new(
                "DeepSeek-R1",
                AgentKind::AiReasoning,
                805_000 * SCALE,
                FixedQty::from_whole(-36),
                initial_price,
                2_500,
            ),
        );

        // 3. [QT] Hawkes-HFT: neutral/slightly long HFT arbitrageur
        portfolios.insert(
            "Hawkes-HFT".to_string(),
            AgentPortfolio::new(
                "Hawkes-HFT",
                AgentKind::QuantAlgo,
                675_000 * SCALE,
                FixedQty::from_whole(22),
                initial_price,
                2_200,
            ),
        );

        // 4. [QT] MM-Alpha: naive over-leveraged long inventory market maker (liquidates in Flash Crash)
        portfolios.insert(
            "MM-Alpha".to_string(),
            AgentPortfolio::new(
                "MM-Alpha",
                AgentKind::QuantAlgo,
                120_000 * SCALE,
                FixedQty::from_whole(268),
                initial_price,
                320, // Tight maintenance margin threshold (3.2% equity drawdown triggers LIQ)
            ),
        );

        // Background ABIDES ecology accounts
        for eco_id in ["ECO-AdaptiveMM", "ECO-OUValue", "ECO-Momentum", "ECO-Noise"] {
            portfolios.insert(
                eco_id.to_string(),
                AgentPortfolio::new(
                    eco_id,
                    AgentKind::BackgroundEcology,
                    2_000_000 * SCALE,
                    FixedQty::from_whole(400),
                    initial_price,
                    9_500,
                ),
            );
        }

        let mut kernel = Self {
            seed,
            rng,
            tick: 0,
            virtual_ts_ns: 1_700_000_000_000_000_000,
            epoch_index: 0,
            clob,
            evm_pool,
            chaos,
            portfolios,
            reasoning_traces: VecDeque::with_capacity(MAX_REASONING_TRACES),
            gemini_spread_bps: 8,
            deepseek_spread_bps: 10,
            price_history: VecDeque::with_capacity(512),
        };

        // Seed initial L2 order book depth and initial reasoning trace at tick 0
        let init_actions = generate_fast_tick_actions(
            0,
            initial_regime,
            kernel.chaos.is_liquidity_vacuum(),
            initial_price,
            initial_price,
            initial_price,
            kernel.gemini_spread_bps,
            kernel.deepseek_spread_bps,
            true,
            &mut kernel.rng,
        );
        for action in init_actions {
            kernel.apply_agent_action(action);
        }
        kernel.run_macro_barrier();
        kernel
    }

    #[inline]
    pub fn seed(&self) -> u64 {
        self.seed
    }

    #[inline]
    pub fn tick(&self) -> u64 {
        self.tick
    }

    #[inline]
    pub fn virtual_ts_ns(&self) -> u64 {
        self.virtual_ts_ns
    }

    #[inline]
    pub fn regime(&self) -> MarketRegime {
        self.chaos.regime()
    }

    #[inline]
    pub fn clob(&self) -> &OrderBook {
        &self.clob
    }

    #[inline]
    pub fn evm_pool(&self) -> &EvmAmmPool {
        &self.evm_pool
    }

    #[inline]
    pub fn price_history(&self) -> &VecDeque<(u64, FixedPrice, FixedPrice, MarketRegime)> {
        &self.price_history
    }

    /// Advances the simulation by 1 fast microstructure tick ($\Delta t = 10\text{ms}$),
    /// and automatically triggers the Slow Macro LLM Epoch Barrier every 100 fast ticks ($1000\text{ms}$).
    pub fn step_fast_tick(&mut self) {
        self.tick += 1;
        self.virtual_ts_ns += FAST_TICK_NS;

        let (regime, regime_changed) = self.chaos.step(self.tick, &mut self.rng);
        let is_vacuum = self.chaos.is_liquidity_vacuum();
        let fund_price = self.chaos.fundamental_value();
        let clob_mid = self.clob.mid_price();
        let evm_spot = self.evm_pool.spot_price();

        if regime_changed && regime.is_ood() {
            self.evm_pool.record_telemetry_alert(
                "0x01f..oracle",
                "ORACLE_UPDATE_LAG",
                &format!(
                    "ORACLE UPDATE LAG: Regime -> {} (Hawkes={}pips)",
                    regime.as_str(),
                    self.chaos.hawkes_intensity_pips() / (SCALE / 100)
                ),
                clob_mid.bps_diff(evm_spot).abs(),
                self.virtual_ts_ns,
            );
        }

        let mm_alpha_active = self
            .portfolios
            .get("MM-Alpha")
            .is_some_and(|p| p.status == AgentStatus::Active);

        let actions = generate_fast_tick_actions(
            self.tick,
            regime,
            is_vacuum,
            fund_price,
            clob_mid,
            evm_spot,
            self.gemini_spread_bps,
            self.deepseek_spread_bps,
            mm_alpha_active,
            &mut self.rng,
        );

        for action in actions {
            self.apply_agent_action(action);
        }

        // Slow Macro LLM Synchronization Barrier every 100 fast ticks (1000ms virtual time)
        let is_macro_epoch = self.tick % MACRO_EPOCH_TICKS == 0;
        if is_macro_epoch {
            self.run_macro_barrier();
        }

        // Mark all portfolios to market & check maintenance margin liquidation
        let updated_mid = self.clob.mid_price();
        let mut newly_liquidated = Vec::new();
        for portfolio in self.portfolios.values_mut() {
            if portfolio.update_valuation(updated_mid, is_macro_epoch, regime) {
                newly_liquidated.push((portfolio.agent_id.clone(), portfolio.max_drawdown_bps));
            }
        }

        for (liq_agent, dd_bps) in newly_liquidated {
            self.clob.cancel_all_for_agent(&liq_agent);
            self.evm_pool.record_telemetry_alert(
                &liq_agent,
                "LIQUIDATION_WARNING",
                &format!(
                    "LIQUIDATION WARNING: {} margin breached (DD={}.{:02}%)",
                    liq_agent,
                    dd_bps / 100,
                    dd_bps % 100
                ),
                dd_bps,
                self.virtual_ts_ns,
            );
        }

        if self.price_history.len() >= 512 {
            self.price_history.pop_front();
        }
        self.price_history.push_back((
            self.tick,
            self.clob.mid_price(),
            self.evm_pool.spot_price(),
            regime,
        ));
    }

    /// Advances the simulation by `n` fast ticks.
    pub fn step_n(&mut self, n: u64) {
        for _ in 0..n {
            self.step_fast_tick();
        }
    }

    /// Triggers an immediate adversarial `FlashCrash` shock and emits an EVM hazard trace.
    pub fn trigger_flash_crash(&mut self) {
        self.chaos.trigger_flash_crash(self.tick);
        self.evm_pool.record_telemetry_alert(
            "ChaosEngine",
            "FLASH_CRASH_INJECTED",
            "ARB SLIPPAGE: 42bps | FLASH CRASH LIQUIDITY CASCADE",
            42,
            self.virtual_ts_ns,
        );
        self.run_macro_barrier();
    }

    /// Explicitly sets the active market regime.
    pub fn set_regime(&mut self, regime: MarketRegime) {
        self.chaos.set_regime(regime, self.tick);
    }

    /// Submits an external agent order directly to the CLOB and updates portfolio accounting.
    pub fn submit_external_order(
        &mut self,
        agent_id: &str,
        side: Side,
        order_type: OrderType,
        price: FixedPrice,
        qty: FixedQty,
    ) -> Result<MatchOutcome, FixedMathError> {
        self.ensure_portfolio_registered(agent_id, AgentKind::AiReasoning);
        let outcome =
            self.clob
                .submit_order(agent_id, side, order_type, price, qty, self.virtual_ts_ns)?;
        self.settle_fills(&outcome);
        Ok(outcome)
    }

    /// Cancels a resting order on the CLOB by `OrderId`.
    pub fn cancel_external_order(&mut self, order_id: OrderId) -> bool {
        self.clob.cancel_order(order_id).is_some()
    }

    /// Executes an external swap against the embedded Revm AMM pool and settles portfolio balances.
    pub fn execute_external_amm_swap(
        &mut self,
        agent_id: &str,
        zero_for_one: bool,
        amount_in: FixedQty,
    ) -> Result<SwapReceipt, FixedMathError> {
        self.ensure_portfolio_registered(agent_id, AgentKind::AiReasoning);
        let receipt =
            self.evm_pool
                .execute_swap(agent_id, zero_for_one, amount_in, self.virtual_ts_ns)?;
        if let Some(portfolio) = self.portfolios.get_mut(agent_id) {
            portfolio.apply_evm_swap(zero_for_one, receipt.amount_in, receipt.amount_out);
        }
        Ok(receipt)
    }

    /// Compiles the current `MacroDigest` for LLM / MCP inspection.
    pub fn compile_macro_digest(&self) -> MacroDigest {
        let clob_mid = self.clob.mid_price();
        let evm_spot = self.evm_pool.spot_price();
        let spread_bps = self.clob.spread_bps();
        let imb_bps = self.clob.order_book_imbalance_bps(5);
        let realized_vol_bps = match self.chaos.regime() {
            MarketRegime::Calm => 12,
            MarketRegime::Trending => 28,
            MarketRegime::LiquidityDrought => 64,
            MarketRegime::FlashCrash => 145,
        };

        MacroDigest {
            epoch_index: self.epoch_index,
            tick: self.tick,
            virtual_ts_ns: self.virtual_ts_ns,
            block_number: self.evm_pool.block_number(),
            regime: self.chaos.regime(),
            clob_mid_price: clob_mid,
            evm_spot_price: evm_spot,
            spread_bps,
            order_book_imbalance_bps: imb_bps,
            realized_vol_bps,
            hawkes_intensity_pips: self.chaos.hawkes_intensity_pips(),
            news_headline: self.chaos.last_headline().to_string(),
        }
    }

    /// Returns ranked leaderboard of competing agents (`AiReasoning` and `QuantAlgo`),
    /// sorted by `acs_score_bps` descending then `current_equity_pips` descending.
    pub fn leaderboard(&self) -> Vec<ScoreReport> {
        let mid = self.clob.mid_price();
        let mut reports: Vec<ScoreReport> = self
            .portfolios
            .values()
            .filter(|p| p.kind != AgentKind::BackgroundEcology)
            .map(|p| p.compute_score_report(mid))
            .collect();

        reports.sort_by(|a, b| {
            b.acs_score_bps
                .cmp(&a.acs_score_bps)
                .then_with(|| b.current_equity_pips.cmp(&a.current_equity_pips))
                .then_with(|| a.agent_id.cmp(&b.agent_id))
        });
        reports
    }

    /// Produces an incremental, canonical SHA-256 hex digest of the entire market state.
    pub fn state_hash(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(b"APEX_ARENA_STATE_V1:");
        hasher.update(self.seed.to_le_bytes());
        hasher.update(self.tick.to_le_bytes());
        hasher.update(self.virtual_ts_ns.to_le_bytes());
        hasher.update(self.epoch_index.to_le_bytes());

        self.chaos.feed_hash(&mut hasher);
        self.clob.feed_hash(&mut hasher);
        self.evm_pool.feed_hash(&mut hasher);

        for (agent_id, portfolio) in &self.portfolios {
            hasher.update(agent_id.as_bytes());
            portfolio.feed_hash(&mut hasher);
        }

        let digest = hasher.finalize();
        let mut hex = String::with_capacity(64);
        for byte in digest {
            use std::fmt::Write;
            let _ = write!(&mut hex, "{:02x}", byte);
        }
        hex
    }

    /// Captures a complete `TickTelemetry` snapshot for TUI or Web Arena rendering.
    pub fn telemetry_snapshot(&self, depth: usize) -> TickTelemetry {
        let book: BookSnapshot = self.clob.top_levels(depth);
        TickTelemetry {
            tick: self.tick,
            virtual_ts_ns: self.virtual_ts_ns,
            block_number: self.evm_pool.block_number(),
            regime: self.chaos.regime(),
            hawkes_intensity_pips: self.chaos.hawkes_intensity_pips(),
            clob_mid_price: book.mid_price,
            evm_spot_price: self.evm_pool.spot_price(),
            spread_bps: book.spread_bps,
            book,
            evm_reserve_base: self.evm_pool.reserve_base(),
            evm_reserve_quote: self.evm_pool.reserve_quote(),
            recent_evm_events: self.evm_pool.recent_events(16),
            recent_reasoning: self.reasoning_traces.iter().rev().take(8).cloned().collect(),
            leaderboard: self.leaderboard(),
            state_hash: self.state_hash(),
        }
    }

    fn run_macro_barrier(&mut self) {
        self.epoch_index += 1;
        let digest = self.compile_macro_digest();
        let (traces, gemini_spread, deepseek_spread, actions) =
            evaluate_macro_epoch_barrier(&digest);
        self.gemini_spread_bps = gemini_spread;
        self.deepseek_spread_bps = deepseek_spread;

        for trace in traces {
            if self.reasoning_traces.len() >= MAX_REASONING_TRACES {
                self.reasoning_traces.pop_front();
            }
            self.reasoning_traces.push_back(trace);
        }

        for action in actions {
            self.apply_agent_action(action);
        }
    }

    fn apply_agent_action(&mut self, action: AgentAction) {
        match action {
            AgentAction::CancelAllAndQuote {
                agent_id,
                bid_price,
                bid_qty,
                ask_price,
                ask_qty,
            } => {
                if self.is_agent_liquidated(&agent_id) {
                    return;
                }
                self.clob.cancel_all_for_agent(&agent_id);
                if let Ok(outcome) = self.clob.submit_order(
                    agent_id.clone(),
                    Side::Bid,
                    OrderType::Limit,
                    bid_price,
                    bid_qty,
                    self.virtual_ts_ns,
                ) {
                    self.settle_fills(&outcome);
                }
                if let Ok(outcome) = self.clob.submit_order(
                    agent_id,
                    Side::Ask,
                    OrderType::Limit,
                    ask_price,
                    ask_qty,
                    self.virtual_ts_ns,
                ) {
                    self.settle_fills(&outcome);
                }
            }
            AgentAction::SubmitOrder {
                agent_id,
                side,
                order_type,
                price,
                qty,
            } => {
                if self.is_agent_liquidated(&agent_id) {
                    return;
                }
                if let Ok(outcome) = self.clob.submit_order(
                    agent_id,
                    side,
                    order_type,
                    price,
                    qty,
                    self.virtual_ts_ns,
                ) {
                    self.settle_fills(&outcome);
                }
            }
            AgentAction::ExecuteAmmSwap {
                agent_id,
                zero_for_one,
                amount_in,
            } => {
                if self.is_agent_liquidated(&agent_id) {
                    return;
                }
                if let Ok(receipt) = self.evm_pool.execute_swap(
                    &agent_id,
                    zero_for_one,
                    amount_in,
                    self.virtual_ts_ns,
                ) {
                    if let Some(portfolio) = self.portfolios.get_mut(&agent_id) {
                        portfolio.apply_evm_swap(
                            zero_for_one,
                            receipt.amount_in,
                            receipt.amount_out,
                        );
                    }
                }
            }
        }
    }

    fn settle_fills(&mut self, outcome: &MatchOutcome) {
        for fill in &outcome.fills {
            if let Some(maker) = self.portfolios.get_mut(&fill.maker_agent_id) {
                maker.apply_clob_fill(fill, true);
            }
            if let Some(taker) = self.portfolios.get_mut(&fill.taker_agent_id) {
                taker.apply_clob_fill(fill, false);
            }
        }
    }

    fn is_agent_liquidated(&self, agent_id: &str) -> bool {
        self.portfolios
            .get(agent_id)
            .is_some_and(|p| p.status == AgentStatus::Liquidated)
    }

    fn ensure_portfolio_registered(&mut self, agent_id: &str, kind: AgentKind) {
        if !self.portfolios.contains_key(agent_id) {
            let mid = self.clob.mid_price();
            self.portfolios.insert(
                agent_id.to_string(),
                AgentPortfolio::new(
                    agent_id,
                    kind,
                    500_000 * SCALE,
                    FixedQty::from_whole(50),
                    mid,
                    2_500,
                ),
            );
        }
    }
}

/// Runs `runs` independent executions of `ArenaKernel` with `seed` for `ticks` fast ticks,
/// returning all state hashes and whether all runs matched bit-for-bit.
pub fn verify_multi_run_determinism(
    seed: u64,
    ticks: u64,
    runs: usize,
    inject_flash_crash_at: Option<u64>,
) -> (bool, Vec<String>) {
    let mut hashes = Vec::with_capacity(runs);
    for _ in 0..runs {
        let mut kernel = ArenaKernel::new(seed, MarketRegime::Calm);
        for t in 1..=ticks {
            if inject_flash_crash_at == Some(t) {
                kernel.trigger_flash_crash();
            }
            kernel.step_fast_tick();
        }
        hashes.push(kernel.state_hash());
    }
    let all_equal = hashes.windows(2).all(|w| w[0] == w[1]);
    (all_equal, hashes)
}
