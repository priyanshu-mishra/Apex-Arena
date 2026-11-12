//! Stylized Rust ABIDES Market Ecology & Competing Benchmark Agents.
//!
//! Includes 4 background market ecology agents (`ECO-AdaptiveMM`, `ECO-Noise`, `ECO-OUValue`,
//! `ECO-Momentum`) and 4 headline benchmark competitors (`Gemini-2.5`, `DeepSeek-R1`,
//! `Hawkes-HFT`, `MM-Alpha`).

use apex_types::{
    AgentReasoningTrace, FixedPrice, FixedQty, MacroDigest, MarketRegime, OrderType, Side, SCALE,
};
use rand::Rng;
use rand_chacha::ChaCha8Rng;

/// Action request emitted by an ecology or benchmark agent during a fast tick or macro barrier.
#[derive(Debug, Clone)]
pub enum AgentAction {
    CancelAllAndQuote {
        agent_id: String,
        bid_price: FixedPrice,
        bid_qty: FixedQty,
        ask_price: FixedPrice,
        ask_qty: FixedQty,
    },
    SubmitOrder {
        agent_id: String,
        side: Side,
        order_type: OrderType,
        price: FixedPrice,
        qty: FixedQty,
    },
    ExecuteAmmSwap {
        agent_id: String,
        zero_for_one: bool,
        amount_in: FixedQty,
    },
}

/// Generates fast-loop (10ms) actions for background ABIDES ecology agents and HFT bots.
pub fn generate_fast_tick_actions(
    tick: u64,
    regime: MarketRegime,
    is_liquidity_vacuum: bool,
    fundamental_price: FixedPrice,
    clob_mid: FixedPrice,
    evm_spot: FixedPrice,
    gemini_spread_bps: i64,
    deepseek_spread_bps: i64,
    mm_alpha_active: bool,
    rng: &mut ChaCha8Rng,
) -> Vec<AgentAction> {
    let mut actions = Vec::with_capacity(12);

    // 1. Background ABIDES Adaptive Market Maker: refreshes multi-level L2 book every 2 ticks
    if tick % 2 == 0 {
        let base_half_spread_bps = if is_liquidity_vacuum { 22 } else { 7 };
        let anchor = FixedPrice::midpoint(clob_mid, fundamental_price);
        let b1 = anchor.apply_bps(-base_half_spread_bps);
        let a1 = anchor.apply_bps(base_half_spread_bps);
        let level_qty = if is_liquidity_vacuum {
            FixedQty::from_milli(2_200)
        } else {
            FixedQty::from_milli(6_500)
        };

        actions.push(AgentAction::CancelAllAndQuote {
            agent_id: "ECO-AdaptiveMM".to_string(),
            bid_price: b1,
            bid_qty: level_qty,
            ask_price: a1,
            ask_qty: level_qty,
        });

        // Deeper outer ladder levels for realistic L2 depth
        for lvl in 1..=4i64 {
            let step_bps = base_half_spread_bps + lvl * 5;
            let depth_qty = FixedQty::from_milli(3_000 + lvl * 2_400);
            actions.push(AgentAction::SubmitOrder {
                agent_id: "ECO-AdaptiveMM".to_string(),
                side: Side::Bid,
                order_type: OrderType::PostOnly,
                price: anchor.apply_bps(-step_bps),
                qty: depth_qty,
            });
            actions.push(AgentAction::SubmitOrder {
                agent_id: "ECO-AdaptiveMM".to_string(),
                side: Side::Ask,
                order_type: OrderType::PostOnly,
                price: anchor.apply_bps(step_bps),
                qty: depth_qty,
            });
        }
    }

    // 2. [QT] MM-Alpha: Naive tight-spread market maker (fails to widen during Flash Crash!)
    if mm_alpha_active && tick % 3 == 0 {
        // MM-Alpha stubbornly quotes tight 4 bps spreads and bids aggressively even in Flash Crash
        let naive_bid = clob_mid.apply_bps(if regime.is_ood() { 8 } else { -4 });
        let naive_ask = clob_mid.apply_bps(6);
        actions.push(AgentAction::CancelAllAndQuote {
            agent_id: "MM-Alpha".to_string(),
            bid_price: naive_bid,
            bid_qty: FixedQty::from_milli(5_500),
            ask_price: naive_ask,
            ask_qty: FixedQty::from_milli(2_000),
        });
    }

    // 3. [AI] Gemini-2.5: Quotes regime-adapted spreads controlled by its Macro Epoch reasoning
    if tick % 4 == 1 {
        let half_spread = gemini_spread_bps.max(6);
        let ref_price = if regime.is_ood() {
            // Shades quotes toward lower fundamental value during crashes to avoid toxic fills
            fundamental_price.apply_bps(-6)
        } else {
            FixedPrice::midpoint(clob_mid, fundamental_price)
        };
        actions.push(AgentAction::CancelAllAndQuote {
            agent_id: "Gemini-2.5".to_string(),
            bid_price: ref_price.apply_bps(-half_spread),
            bid_qty: FixedQty::from_milli(3_200),
            ask_price: ref_price.apply_bps(half_spread - 2),
            ask_qty: FixedQty::from_milli(3_800),
        });
    }

    // 4. [AI] DeepSeek-R1: Quotes mean-reverting liquidity & statistical arb
    if tick % 5 == 2 {
        let half_spread = deepseek_spread_bps.max(7);
        let ref_price = FixedPrice::midpoint(clob_mid, evm_spot);
        actions.push(AgentAction::CancelAllAndQuote {
            agent_id: "DeepSeek-R1".to_string(),
            bid_price: ref_price.apply_bps(-half_spread),
            bid_qty: FixedQty::from_milli(2_800),
            ask_price: ref_price.apply_bps(half_spread),
            ask_qty: FixedQty::from_milli(3_100),
        });
    }

    // 5. Background ABIDES OU-Value Agent: trades toward fundamental_price
    if tick % 3 == 1 {
        let diff_bps = clob_mid.bps_diff(fundamental_price);
        if diff_bps.abs() >= 6 {
            let side = if diff_bps > 0 { Side::Bid } else { Side::Ask };
            let qty_milli = rng.gen_range(1_200..3_600);
            actions.push(AgentAction::SubmitOrder {
                agent_id: "ECO-OUValue".to_string(),
                side,
                order_type: OrderType::IOC,
                price: fundamental_price,
                qty: FixedQty::from_milli(qty_milli),
            });
        }
    }

    // 6. Background ABIDES Noise & Momentum Agents
    if tick % 2 == 1 {
        let is_sell = match regime {
            MarketRegime::FlashCrash => rng.gen_range(0..100) < 78,
            MarketRegime::LiquidityDrought => rng.gen_range(0..100) < 62,
            MarketRegime::Trending => rng.gen_range(0..100) < 42,
            MarketRegime::Calm => rng.gen_range(0..100) < 50,
        };
        let side = if is_sell { Side::Ask } else { Side::Bid };
        let qty_milli = if regime == MarketRegime::FlashCrash {
            rng.gen_range(2_500..6_800)
        } else {
            rng.gen_range(800..2_600)
        };
        actions.push(AgentAction::SubmitOrder {
            agent_id: if tick % 4 == 1 {
                "ECO-Momentum".to_string()
            } else {
                "ECO-Noise".to_string()
            },
            side,
            order_type: OrderType::Market,
            price: clob_mid,
            qty: FixedQty::from_milli(qty_milli),
        });
    }

    // 7. [QT] Hawkes-HFT: Cross-venue CLOB <-> Revm AMM arbitrage & flow execution
    if tick % 5 == 0 {
        let basis_bps = evm_spot.bps_diff(clob_mid);
        if basis_bps.abs() >= 12 {
            if basis_bps > 0 {
                // CLOB Mid > EVM Spot: Buy ETH on EVM AMM (USDT -> ETH) and Sell ETH on CLOB
                let usdt_in = FixedQty::from_whole(6_500);
                actions.push(AgentAction::ExecuteAmmSwap {
                    agent_id: "Hawkes-HFT".to_string(),
                    zero_for_one: false,
                    amount_in: usdt_in,
                });
                actions.push(AgentAction::SubmitOrder {
                    agent_id: "Hawkes-HFT".to_string(),
                    side: Side::Ask,
                    order_type: OrderType::IOC,
                    price: clob_mid.apply_bps(-5),
                    qty: FixedQty::from_milli(2_800),
                });
            } else {
                // EVM Spot > CLOB Mid: Sell ETH on EVM AMM (ETH -> USDT) and Buy ETH on CLOB
                actions.push(AgentAction::ExecuteAmmSwap {
                    agent_id: "Hawkes-HFT".to_string(),
                    zero_for_one: true,
                    amount_in: FixedQty::from_milli(3_000),
                });
                actions.push(AgentAction::SubmitOrder {
                    agent_id: "Hawkes-HFT".to_string(),
                    side: Side::Bid,
                    order_type: OrderType::IOC,
                    price: clob_mid.apply_bps(5),
                    qty: FixedQty::from_milli(2_500),
                });
            }
        } else if tick % 15 == 0 {
            // Periodic Revm pool rebalance swap to keep on-chain trace active
            let zero_for_one = regime.is_ood();
            let amt = if zero_for_one {
                FixedQty::from_milli(2_400)
            } else {
                FixedQty::from_whole(5_200)
            };
            actions.push(AgentAction::ExecuteAmmSwap {
                agent_id: "Hawkes-HFT".to_string(),
                zero_for_one,
                amount_in: amt,
            });
        }
    }

    actions
}

/// Evaluates the Slow Macro LLM Barrier (every 100 fast ticks = 1000ms virtual time),
/// returning deterministic reasoning traces and target spread parameters for `[AI]` agents.
pub fn evaluate_macro_epoch_barrier(
    digest: &MacroDigest,
) -> (Vec<AgentReasoningTrace>, i64, i64, Vec<AgentAction>) {
    let mut traces = Vec::with_capacity(2);
    let mut macro_actions = Vec::new();

    let (gemini_spread, gemini_skew, gemini_thought, gemini_tool) = match digest.regime {
        MarketRegime::Calm => (
            8,
            0,
            format!(
                "Order book imbalance {}bps within normal bounds; quoting symmetric 8bps spread around {}.",
                digest.order_book_imbalance_bps, digest.clob_mid_price
            ),
            "mcp.set_mm_params(spread_bps=8, skew_bps=0)".to_string(),
        ),
        MarketRegime::Trending => (
            11,
            -6,
            format!(
                "Directional momentum detected (Hawkes={}pips); widening spread to 11bps & skewing inventory.",
                digest.hawkes_intensity_pips / (SCALE / 100)
            ),
            "mcp.set_mm_params(spread_bps=11, skew_bps=-6)".to_string(),
        ),
        MarketRegime::LiquidityDrought => (
            24,
            -15,
            format!(
                "OOD Liquidity Drought alert: L2 spread={}bps. Widening quotes to 24bps & hedging long delta.",
                digest.spread_bps
            ),
            "mcp.set_mm_params(spread_bps=24, hedge_delta=true)".to_string(),
        ),
        MarketRegime::FlashCrash => {
            // Gemini-2.5 actively hedges tail risk during Flash Crash and profits from short delta
            macro_actions.push(AgentAction::SubmitOrder {
                agent_id: "Gemini-2.5".to_string(),
                side: Side::Ask,
                order_type: OrderType::IOC,
                price: digest.clob_mid_price.apply_bps(-15),
                qty: FixedQty::from_milli(3_500),
            });
            (
                38,
                -28,
                format!(
                    "FLASH CRASH detected! Hawkes panic threshold breached. Widening spread to 38bps & offloading inventory."
                ),
                "mcp.submit_clob_order(side='ASK', type='IOC', qty=3.50)".to_string(),
            )
        }
    };

    traces.push(AgentReasoningTrace {
        tick: digest.tick,
        virtual_ts_ns: digest.virtual_ts_ns,
        agent_id: "Gemini-2.5".to_string(),
        regime: digest.regime,
        thought_summary: gemini_thought,
        tool_action: gemini_tool,
        target_spread_bps: gemini_spread,
        inventory_skew_bps: gemini_skew,
    });

    let basis_bps = digest.evm_spot_price.bps_diff(digest.clob_mid_price);
    let (deepseek_spread, deepseek_skew, deepseek_thought, deepseek_tool) = if digest.regime.is_ood()
    {
        macro_actions.push(AgentAction::ExecuteAmmSwap {
            agent_id: "DeepSeek-R1".to_string(),
            zero_for_one: true,
            amount_in: FixedQty::from_milli(2_000),
        });
        (
            30,
            -18,
            format!(
                "Regime={} | CLOB-Revm basis={}bps. Executing defensive CFMM swap & widening spread to 30bps.",
                digest.regime, basis_bps
            ),
            "mcp.execute_evm_swap(zero_for_one=true, amount_in=2.00)".to_string(),
        )
    } else {
        (
            10,
            basis_bps / 2,
            format!(
                "Cross-venue basis {}bps between CLOB ({}) and Revm ({}); capturing statistical reversion.",
                basis_bps, digest.clob_mid_price, digest.evm_spot_price
            ),
            format!("mcp.set_mm_params(spread_bps=10, skew_bps={})", basis_bps / 2),
        )
    };

    traces.push(AgentReasoningTrace {
        tick: digest.tick,
        virtual_ts_ns: digest.virtual_ts_ns,
        agent_id: "DeepSeek-R1".to_string(),
        regime: digest.regime,
        thought_summary: deepseek_thought,
        tool_action: deepseek_tool,
        target_spread_bps: deepseek_spread,
        inventory_skew_bps: deepseek_skew,
    });

    (traces, gemini_spread, deepseek_spread, macro_actions)
}
