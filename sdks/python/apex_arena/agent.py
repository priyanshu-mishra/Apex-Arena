"""Agent SDK base classes and Hybrid Neuro-Symbolic Market Maker template."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .engine import BPS_SCALE, SCALE, ArenaEngine


@dataclass
class OrderIntent:
    """Represents a deterministic order action emitted by a Python strategy."""

    side: str
    order_type: str
    price_pips: int
    qty_pips: int


class ApexAgent:
    """Base strategy template for ApexArena quantitative and hybrid LLM agents."""

    def __init__(self, agent_id: str) -> None:
        self.agent_id = agent_id

    def on_tick(self, state: dict[str, Any]) -> list[OrderIntent]:
        """Invoked on fast microstructure ticks (10ms virtual intervals).

        Args:
            state: Full `TickTelemetry` snapshot dictionary.

        Returns:
            List of `OrderIntent` objects to submit to the L3 CLOB.
        """
        return []

    def on_macro_epoch(self, digest: dict[str, Any]) -> dict[str, Any]:
        """Invoked at the Slow Macro Synchronization Barrier (1000ms = 100 fast ticks).

        Args:
            digest: Aggregated `MacroDigest` with order book imbalance, regime, and news wire.

        Returns:
            Dictionary of updated strategy parameters (e.g., `spread_bps`, `skew_bps`).
        """
        return {}


class HybridLLMMarketMaker(ApexAgent):
    """Reference Hybrid LLM + Microstructure Market Maker (`hybrid-llm-mm`).

    Combines fast 10ms fixed-point quoting with 1000ms macro-barrier regime reasoning
    that widens spreads and skews inventory during `LIQUIDITY DROUGHT` and `FLASH CRASH`.
    """

    def __init__(
        self,
        agent_id: str = "Hybrid-LLM-MM",
        base_spread_bps: int = 10,
        quote_size_eth: float = 1.5,
    ) -> None:
        super().__init__(agent_id=agent_id)
        self.base_spread_bps = base_spread_bps
        self.active_spread_bps = base_spread_bps
        self.skew_bps = 0
        self.quote_qty_pips = int(round(quote_size_eth * SCALE))

    def on_macro_epoch(self, digest: dict[str, Any]) -> dict[str, Any]:
        regime = str(digest.get("regime", "Calm"))
        imbalance_bps = int(digest.get("order_book_imbalance_bps", 0))

        if regime in ("FlashCrash", "FLASH CRASH"):
            self.active_spread_bps = max(self.base_spread_bps * 4, 36)
            self.skew_bps = -20
        elif regime in ("LiquidityDrought", "LIQUIDITY DROUGHT"):
            self.active_spread_bps = max(self.base_spread_bps * 2, 22)
            self.skew_bps = -10
        else:
            self.active_spread_bps = self.base_spread_bps
            self.skew_bps = imbalance_bps // 25

        return {
            "agent_id": self.agent_id,
            "regime": regime,
            "target_spread_bps": self.active_spread_bps,
            "skew_bps": self.skew_bps,
        }

    def on_tick(self, state: dict[str, Any]) -> list[OrderIntent]:
        tick = int(state.get("tick", 0))
        if tick % 5 != 0:
            return []

        mid_pips = int(state.get("clob_mid_price", 2241 * SCALE))
        half_spread = max(self.active_spread_bps // 2, 4)
        bid_offset_bps = -half_spread + self.skew_bps
        ask_offset_bps = half_spread + self.skew_bps

        bid_pips = (mid_pips * (BPS_SCALE + bid_offset_bps)) // BPS_SCALE
        ask_pips = (mid_pips * (BPS_SCALE + ask_offset_bps)) // BPS_SCALE

        return [
            OrderIntent(
                side="BID",
                order_type="POST_ONLY",
                price_pips=bid_pips,
                qty_pips=self.quote_qty_pips,
            ),
            OrderIntent(
                side="ASK",
                order_type="POST_ONLY",
                price_pips=ask_pips,
                qty_pips=self.quote_qty_pips,
            ),
        ]


def run_agent_simulation(
    agent: ApexAgent,
    seed: int = 42,
    regime: str = "calm",
    ticks: int = 200,
) -> dict[str, Any]:
    """Runs `agent` inside a deterministic `ArenaEngine` for `ticks` fast ticks."""
    engine = ArenaEngine(seed=seed, regime=regime)
    submitted_orders = 0
    macro_updates = 0

    for t in range(1, ticks + 1):
        engine.step()
        if t % 100 == 0:
            digest = engine.macro_digest()
            agent.on_macro_epoch(digest)
            macro_updates += 1

        state = engine.telemetry(depth=5)
        intents = agent.on_tick(state)
        for intent in intents:
            engine.submit_order(
                agent_id=agent.agent_id,
                side=intent.side,
                order_type=intent.order_type,
                price_pips=intent.price_pips,
                qty_pips=intent.qty_pips,
            )
            submitted_orders += 1

    return {
        "seed": seed,
        "ticks": ticks,
        "submitted_orders": submitted_orders,
        "macro_updates": macro_updates,
        "final_state_hash": engine.state_hash(),
        "leaderboard": engine.leaderboard(),
    }
