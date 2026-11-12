//! L3 Central Limit Order Book (CLOB) Matching Engine for ApexArena.
//!
//! Enforces strict Price-Time Priority using `BTreeMap<FixedPrice, VecDeque<Order>>`
//! and implements Cancel-Newest Self-Trade Prevention (STP).

use apex_types::{
    BookSnapshot, Fill, FixedMathError, FixedPrice, FixedQty, L2Level, MatchOutcome, Order,
    OrderId, OrderType, Side, BPS_SCALE,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, VecDeque};

/// Maker fee in basis points (1 bps = 0.01%).
pub const DEFAULT_MAKER_FEE_BPS: i64 = 1;
/// Taker fee in basis points (4 bps = 0.04%).
pub const DEFAULT_TAKER_FEE_BPS: i64 = 4;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBook {
    symbol: String,
    next_order_id: u64,
    bids: BTreeMap<FixedPrice, VecDeque<Order>>,
    asks: BTreeMap<FixedPrice, VecDeque<Order>>,
    order_index: BTreeMap<OrderId, (Side, FixedPrice)>,
    last_trade_price: FixedPrice,
    maker_fee_bps: i64,
    taker_fee_bps: i64,
}

impl OrderBook {
    pub fn new(symbol: impl Into<String>, initial_mid_price: FixedPrice) -> Self {
        Self {
            symbol: symbol.into(),
            next_order_id: 1,
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            order_index: BTreeMap::new(),
            last_trade_price: initial_mid_price,
            maker_fee_bps: DEFAULT_MAKER_FEE_BPS,
            taker_fee_bps: DEFAULT_TAKER_FEE_BPS,
        }
    }

    #[inline]
    pub fn symbol(&self) -> &str {
        &self.symbol
    }

    #[inline]
    pub fn last_trade_price(&self) -> FixedPrice {
        self.last_trade_price
    }

    #[inline]
    pub fn best_bid(&self) -> Option<FixedPrice> {
        self.bids
            .iter()
            .next_back()
            .and_then(|(price, q)| if q.is_empty() { None } else { Some(*price) })
    }

    #[inline]
    pub fn best_ask(&self) -> Option<FixedPrice> {
        self.asks
            .iter()
            .next()
            .and_then(|(price, q)| if q.is_empty() { None } else { Some(*price) })
    }

    #[inline]
    pub fn mid_price(&self) -> FixedPrice {
        match (self.best_bid(), self.best_ask()) {
            (Some(bid), Some(ask)) => FixedPrice::midpoint(bid, ask),
            (Some(bid), None) => bid,
            (None, Some(ask)) => ask,
            (None, None) => self.last_trade_price,
        }
    }

    #[inline]
    pub fn spread_bps(&self) -> i64 {
        match (self.best_bid(), self.best_ask()) {
            (Some(bid), Some(ask)) => FixedPrice::spread_bps(bid, ask),
            _ => 0,
        }
    }

    /// Submits a new order into the L3 matching engine with Price-Time Priority
    /// and Cancel-Newest Self-Trade Prevention.
    pub fn submit_order(
        &mut self,
        agent_id: impl Into<String>,
        side: Side,
        order_type: OrderType,
        price: FixedPrice,
        qty: FixedQty,
        virtual_ts_ns: u64,
    ) -> Result<MatchOutcome, FixedMathError> {
        if qty.0 <= 0 {
            return Err(FixedMathError::InvalidOrder("order quantity must be > 0"));
        }
        if order_type != OrderType::Market && price.0 <= 0 {
            return Err(FixedMathError::InvalidOrder(
                "limit/post-only/ioc price must be > 0",
            ));
        }

        let agent_id = agent_id.into();
        let order_id = OrderId(self.next_order_id);
        self.next_order_id += 1;

        // PostOnly check: reject immediately if the order would cross the opposing best price
        if order_type == OrderType::PostOnly {
            let crosses = match side {
                Side::Bid => self.best_ask().is_some_and(|ask| price >= ask),
                Side::Ask => self.best_bid().is_some_and(|bid| price <= bid),
            };
            if crosses {
                return Ok(MatchOutcome {
                    order_id,
                    fills: Vec::new(),
                    rested_qty: FixedQty::ZERO,
                    canceled_qty: qty,
                    self_trade_prevented: false,
                    post_only_rejected: true,
                });
            }
        }

        let mut remaining = qty;
        let mut fills = Vec::new();
        let mut self_trade_prevented = false;

        // Match against opposing book if not PostOnly
        if order_type != OrderType::PostOnly {
            loop {
                if remaining.0 <= 0 {
                    break;
                }

                let opposing_best_price = match side {
                    Side::Bid => self.asks.keys().next().copied(),
                    Side::Ask => self.bids.keys().next_back().copied(),
                };

                let Some(best_price) = opposing_best_price else {
                    break;
                };

                let price_crosses = match (order_type, side) {
                    (OrderType::Market, _) => true,
                    (_, Side::Bid) => price >= best_price,
                    (_, Side::Ask) => price <= best_price,
                };

                if !price_crosses {
                    break;
                }

                let mut remove_level = false;
                let mut stp_triggered = false;

                {
                    let book_side = match side {
                        Side::Bid => &mut self.asks,
                        Side::Ask => &mut self.bids,
                    };
                    let queue = book_side
                        .get_mut(&best_price)
                        .expect("best_price level exists");

                    while remaining.0 > 0 {
                        let Some(maker) = queue.front_mut() else {
                            break;
                        };

                        // Cancel-Newest Self-Trade Prevention (STP)
                        if maker.agent_id == agent_id {
                            stp_triggered = true;
                            self_trade_prevented = true;
                            break;
                        }

                        let match_pips = remaining.0.min(maker.remaining_qty.0);
                        let match_qty = FixedQty(match_pips);
                        remaining.0 -= match_pips;
                        maker.remaining_qty.0 -= match_pips;

                        let notional = best_price.notional_pips(match_qty);
                        let maker_fee_pips = ((notional as i128) * (self.maker_fee_bps as i128)
                            / (BPS_SCALE as i128))
                            as i64;
                        let taker_fee_pips = ((notional as i128) * (self.taker_fee_bps as i128)
                            / (BPS_SCALE as i128))
                            as i64;

                        self.last_trade_price = best_price;

                        fills.push(Fill {
                            maker_order_id: maker.id,
                            taker_order_id: order_id,
                            maker_agent_id: maker.agent_id.clone(),
                            taker_agent_id: agent_id.clone(),
                            price: best_price,
                            qty: match_qty,
                            taker_side: side,
                            maker_fee_pips,
                            taker_fee_pips,
                            virtual_ts_ns,
                        });

                        if maker.remaining_qty.0 == 0 {
                            let completed_maker = queue.pop_front().expect("front order exists");
                            self.order_index.remove(&completed_maker.id);
                        }
                    }

                    if queue.is_empty() {
                        remove_level = true;
                    }
                }

                if remove_level {
                    match side {
                        Side::Bid => {
                            self.asks.remove(&best_price);
                        }
                        Side::Ask => {
                            self.bids.remove(&best_price);
                        }
                    }
                }

                if stp_triggered {
                    break;
                }
            }
        }

        // Rest remaining quantity on the book if Limit or PostOnly and not STP-canceled
        let (rested_qty, canceled_qty) = if remaining.0 > 0
            && !self_trade_prevented
            && matches!(order_type, OrderType::Limit | OrderType::PostOnly)
        {
            let order = Order {
                id: order_id,
                agent_id,
                side,
                order_type,
                price,
                original_qty: qty,
                remaining_qty: remaining,
                virtual_ts_ns,
            };
            match side {
                Side::Bid => self.bids.entry(price).or_default().push_back(order),
                Side::Ask => self.asks.entry(price).or_default().push_back(order),
            }
            self.order_index.insert(order_id, (side, price));
            (remaining, FixedQty::ZERO)
        } else {
            (FixedQty::ZERO, remaining)
        };

        Ok(MatchOutcome {
            order_id,
            fills,
            rested_qty,
            canceled_qty,
            self_trade_prevented,
            post_only_rejected: false,
        })
    }

    /// Cancels a resting order by `OrderId` in `O(log N + K)` time.
    pub fn cancel_order(&mut self, order_id: OrderId) -> Option<Order> {
        let (side, price) = self.order_index.remove(&order_id)?;
        let book_side = match side {
            Side::Bid => &mut self.bids,
            Side::Ask => &mut self.asks,
        };

        let queue = book_side.get_mut(&price)?;
        let pos = queue.iter().position(|o| o.id == order_id)?;
        let removed = queue.remove(pos)?;
        if queue.is_empty() {
            book_side.remove(&price);
        }
        Some(removed)
    }

    /// Cancels all resting orders owned by `agent_id`.
    pub fn cancel_all_for_agent(&mut self, agent_id: &str) -> usize {
        let mut to_cancel = Vec::new();
        for queue in self.bids.values() {
            for order in queue {
                if order.agent_id == agent_id {
                    to_cancel.push(order.id);
                }
            }
        }
        for queue in self.asks.values() {
            for order in queue {
                if order.agent_id == agent_id {
                    to_cancel.push(order.id);
                }
            }
        }
        let mut count = 0;
        for id in to_cancel {
            if self.cancel_order(id).is_some() {
                count += 1;
            }
        }
        count
    }

    /// Returns top `depth` aggregated L2 levels for bids and asks.
    pub fn top_levels(&self, depth: usize) -> BookSnapshot {
        let bids: Vec<L2Level> = self
            .bids
            .iter()
            .rev()
            .filter(|(_, q)| !q.is_empty())
            .take(depth)
            .map(|(price, q)| {
                let total_pips: i64 = q.iter().map(|o| o.remaining_qty.0).sum();
                L2Level {
                    price: *price,
                    total_qty: FixedQty(total_pips),
                    order_count: q.len(),
                }
            })
            .collect();

        let asks: Vec<L2Level> = self
            .asks
            .iter()
            .filter(|(_, q)| !q.is_empty())
            .take(depth)
            .map(|(price, q)| {
                let total_pips: i64 = q.iter().map(|o| o.remaining_qty.0).sum();
                L2Level {
                    price: *price,
                    total_qty: FixedQty(total_pips),
                    order_count: q.len(),
                }
            })
            .collect();

        BookSnapshot {
            bids,
            asks,
            best_bid: self.best_bid(),
            best_ask: self.best_ask(),
            mid_price: self.mid_price(),
            spread_bps: self.spread_bps(),
        }
    }

    /// Computes top-N order book volume imbalance in basis points `[-10000, +10000]`.
    pub fn order_book_imbalance_bps(&self, depth: usize) -> i64 {
        let snap = self.top_levels(depth);
        let bid_vol: i128 = snap.bids.iter().map(|l| l.total_qty.0 as i128).sum();
        let ask_vol: i128 = snap.asks.iter().map(|l| l.total_qty.0 as i128).sum();
        let total = bid_vol + ask_vol;
        if total == 0 {
            return 0;
        }
        (((bid_vol - ask_vol) * (BPS_SCALE as i128)) / total) as i64
    }

    /// Feeds the complete canonical L3 order book state into a SHA-256 hasher.
    pub fn feed_hash(&self, hasher: &mut Sha256) {
        hasher.update(self.symbol.as_bytes());
        hasher.update(self.next_order_id.to_le_bytes());
        hasher.update(self.last_trade_price.0.to_le_bytes());

        for (price, queue) in &self.bids {
            hasher.update(b"B");
            hasher.update(price.0.to_le_bytes());
            for order in queue {
                hasher.update(order.id.0.to_le_bytes());
                hasher.update(order.agent_id.as_bytes());
                hasher.update(order.remaining_qty.0.to_le_bytes());
                hasher.update(order.virtual_ts_ns.to_le_bytes());
            }
        }

        for (price, queue) in &self.asks {
            hasher.update(b"A");
            hasher.update(price.0.to_le_bytes());
            for order in queue {
                hasher.update(order.id.0.to_le_bytes());
                hasher.update(order.agent_id.as_bytes());
                hasher.update(order.remaining_qty.0.to_le_bytes());
                hasher.update(order.virtual_ts_ns.to_le_bytes());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_price_time_priority_and_matching() {
        let mut book = OrderBook::new("ETH-USDT", FixedPrice::from_whole(2240));

        // Two makers at $2242.00
        let m1 = book
            .submit_order(
                "maker-1",
                Side::Ask,
                OrderType::Limit,
                FixedPrice::from_whole(2242),
                FixedQty::from_whole(5),
                10_000_000,
            )
            .unwrap();
        let m2 = book
            .submit_order(
                "maker-2",
                Side::Ask,
                OrderType::Limit,
                FixedPrice::from_whole(2242),
                FixedQty::from_whole(5),
                20_000_000,
            )
            .unwrap();

        // Better ask at $2241.00
        let m3 = book
            .submit_order(
                "maker-3",
                Side::Ask,
                OrderType::Limit,
                FixedPrice::from_whole(2241),
                FixedQty::from_whole(3),
                30_000_000,
            )
            .unwrap();

        // Taker buys 6 ETH at limit $2242.00 -> fills 3 ETH @ $2241 (m3) then 3 ETH @ $2242 (m1)
        let taker = book
            .submit_order(
                "taker-1",
                Side::Bid,
                OrderType::Limit,
                FixedPrice::from_whole(2242),
                FixedQty::from_whole(6),
                40_000_000,
            )
            .unwrap();

        assert_eq!(taker.fills.len(), 2);
        assert_eq!(taker.fills[0].maker_order_id, m3.order_id);
        assert_eq!(taker.fills[0].price, FixedPrice::from_whole(2241));
        assert_eq!(taker.fills[0].qty, FixedQty::from_whole(3));

        assert_eq!(taker.fills[1].maker_order_id, m1.order_id);
        assert_eq!(taker.fills[1].price, FixedPrice::from_whole(2242));
        assert_eq!(taker.fills[1].qty, FixedQty::from_whole(3));

        let snap = book.top_levels(5);
        assert_eq!(snap.asks.len(), 1);
        assert_eq!(snap.asks[0].price, FixedPrice::from_whole(2242));
        // 2 ETH left on m1 + 5 ETH on m2 = 7 ETH
        assert_eq!(snap.asks[0].total_qty, FixedQty::from_whole(7));
        assert_eq!(m2.rested_qty, FixedQty::from_whole(5));
    }

    #[test]
    fn test_self_trade_prevention_cancel_newest() {
        let mut book = OrderBook::new("ETH-USDT", FixedPrice::from_whole(2240));

        book.submit_order(
            "bot-alpha",
            Side::Ask,
            OrderType::Limit,
            FixedPrice::from_whole(2240),
            FixedQty::from_whole(10),
            10_000_000,
        )
        .unwrap();

        // Same agent tries to buy across its own ask -> Cancel-Newest cancels taker
        let outcome = book
            .submit_order(
                "bot-alpha",
                Side::Bid,
                OrderType::Limit,
                FixedPrice::from_whole(2241),
                FixedQty::from_whole(4),
                20_000_000,
            )
            .unwrap();

        assert!(outcome.self_trade_prevented);
        assert!(outcome.fills.is_empty());
        assert_eq!(outcome.rested_qty, FixedQty::ZERO);
        assert_eq!(outcome.canceled_qty, FixedQty::from_whole(4));
        // Resting maker order remains untouched
        assert_eq!(book.best_ask(), Some(FixedPrice::from_whole(2240)));
    }
}
