"""Deterministic Python wrapper around the Rust PyO3 `apex_arena._core` kernel."""

from __future__ import annotations

import json
from typing import Any

from apex_arena._core import PyArenaKernel, py_verify_determinism

SCALE: int = 100_000_000
BPS_SCALE: int = 10_000


def to_pips(value: float | int) -> int:
    """Converts a human-readable price or quantity into integer fixed-point pips (SCALE = 10^8)."""
    return int(round(float(value) * SCALE))


def from_pips(pips: int) -> float:
    """Converts integer fixed-point pips (SCALE = 10^8) to a float for display."""
    return int(pips) / float(SCALE)


class ArenaEngine:
    """High-level Python interface to the Rust `PyArenaKernel` simulation engine."""

    def __init__(self, seed: int = 42, regime: str = "calm") -> None:
        self._kernel = PyArenaKernel(seed=seed, regime=regime)
        self.seed = seed

    @property
    def tick(self) -> int:
        return int(self._kernel.tick())

    @property
    def virtual_ts_ns(self) -> int:
        return int(self._kernel.virtual_ts_ns())

    @property
    def regime(self) -> str:
        return str(self._kernel.regime())

    def step(self) -> str:
        """Advances the arena by 1 fast microstructure tick (10ms) and returns the SHA-256 state hash."""
        return str(self._kernel.step())

    def step_n(self, ticks: int) -> str:
        """Advances the arena by `ticks` fast ticks and returns the SHA-256 state hash."""
        return str(self._kernel.step_n(ticks))

    def trigger_flash_crash(self) -> None:
        """Injects an immediate Flash Crash liquidity cascade into the chaos engine."""
        self._kernel.trigger_flash_crash()

    def set_regime(self, regime: str) -> None:
        """Explicitly transitions the market regime (`calm`, `trending`, `liquidity-drought`, `flash-crash`)."""
        self._kernel.set_regime(regime)

    def submit_order(
        self,
        agent_id: str,
        side: str,
        order_type: str,
        price_pips: int,
        qty_pips: int,
    ) -> dict[str, Any]:
        """Submits an order to the L3 CLOB using integer fixed-point pips (`SCALE = 10^8`)."""
        raw = self._kernel.submit_order(agent_id, side, order_type, int(price_pips), int(qty_pips))
        return json.loads(raw)

    def cancel_order(self, order_id: int) -> bool:
        """Cancels a resting order on the L3 CLOB by `order_id`."""
        return bool(self._kernel.cancel_order(int(order_id)))

    def execute_amm_swap(
        self,
        agent_id: str,
        zero_for_one: bool,
        amount_in_pips: int,
    ) -> dict[str, Any]:
        """Executes a constant-product swap on the embedded Bluealloy Revm AMM pool."""
        raw = self._kernel.execute_amm_swap(agent_id, bool(zero_for_one), int(amount_in_pips))
        return json.loads(raw)

    def macro_digest(self) -> dict[str, Any]:
        """Returns the current slow macro barrier market context digest."""
        return json.loads(self._kernel.macro_digest_json())

    def telemetry(self, depth: int = 8) -> dict[str, Any]:
        """Returns a complete `TickTelemetry` dictionary including L2 book, EVM events, and leaderboard."""
        return json.loads(self._kernel.telemetry_json(depth))

    def leaderboard(self) -> list[dict[str, Any]]:
        """Returns the ranked agent leaderboard with PSR(0), Capped Calmar, OOD Survival, and ACS scores."""
        return json.loads(self._kernel.leaderboard_json())

    def state_hash(self) -> str:
        """Returns the 64-character SHA-256 hex digest of the canonical simulation state."""
        return str(self._kernel.state_hash())


def verify_determinism(seed: int = 42, ticks: int = 300, runs: int = 5) -> tuple[bool, list[str]]:
    """Executes `runs` independent Rust kernel simulations and verifies bit-for-bit SHA-256 equality."""
    all_equal, hashes = py_verify_determinism(seed=seed, ticks=ticks, runs=runs)
    return bool(all_equal), list(hashes)
