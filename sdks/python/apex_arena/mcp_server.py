"""Model Context Protocol (MCP) Server Bridge for ApexArena.

Exposes the deterministic CLOB + Revm simulation kernel over JSON-RPC 2.0 (stdio and in-memory)
so external frontier LLMs (Claude, Gemini, OpenAI, DeepSeek) can inspect market state and
execute orders or AMM swaps via tool calling.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

from .engine import ArenaEngine, to_pips, verify_determinism


class ApexMcpServer:
    """Stateful MCP JSON-RPC 2.0 handler backed by `ArenaEngine`."""

    def __init__(self, seed: int = 42, regime: str = "calm") -> None:
        self.engine = ArenaEngine(seed=seed, regime=regime)
        self.engine.step_n(20)

    def list_tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "get_market_digest",
                "description": (
                    "Returns the Slow Macro Barrier market context digest including virtual tick, "
                    "CLOB mid-price, Revm spot price, spread bps, L2 imbalance, Hawkes intensity, "
                    "and synthetic news wire headline."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "advance_ticks": {
                            "type": "integer",
                            "description": "Optional number of fast 10ms ticks to advance before reading state.",
                            "default": 0,
                        }
                    },
                },
            },
            {
                "name": "get_orderbook_l2",
                "description": "Returns top-of-book L2 bid/ask ladder levels, spread in bps, and SHA-256 state hash.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "depth": {
                            "type": "integer",
                            "description": "Number of price levels per side (1-15).",
                            "default": 5,
                        }
                    },
                },
            },
            {
                "name": "submit_clob_order",
                "description": "Submits a Limit, Market, PostOnly, or IOC order to the L3 CLOB with Cancel-Newest STP.",
                "inputSchema": {
                    "type": "object",
                    "required": ["agent_id", "side", "order_type", "price", "qty"],
                    "properties": {
                        "agent_id": {"type": "string"},
                        "side": {"type": "string", "enum": ["BID", "ASK"]},
                        "order_type": {
                            "type": "string",
                            "enum": ["LIMIT", "MARKET", "POST_ONLY", "IOC"],
                        },
                        "price": {
                            "type": "number",
                            "description": "Limit price in USD (e.g. 2241.50). Converted to FixedPrice(i64) pips.",
                        },
                        "qty": {
                            "type": "number",
                            "description": "Order quantity in ETH (e.g. 2.50). Converted to FixedQty(i64) pips.",
                        },
                    },
                },
            },
            {
                "name": "execute_evm_swap",
                "description": "Executes an on-chain constant-product (x*y=k, 30bps fee) swap inside the embedded Revm sandbox.",
                "inputSchema": {
                    "type": "object",
                    "required": ["agent_id", "zero_for_one", "amount_in"],
                    "properties": {
                        "agent_id": {"type": "string"},
                        "zero_for_one": {
                            "type": "boolean",
                            "description": "True to swap ETH -> USDT; False to swap USDT -> ETH.",
                        },
                        "amount_in": {
                            "type": "number",
                            "description": "Input token quantity (ETH if zero_for_one=True, USDT if False).",
                        },
                    },
                },
            },
            {
                "name": "trigger_chaos_regime",
                "description": "Transitions the chaos engine into a target regime or triggers an immediate Flash Crash.",
                "inputSchema": {
                    "type": "object",
                    "required": ["regime"],
                    "properties": {
                        "regime": {
                            "type": "string",
                            "enum": ["calm", "trending", "liquidity-drought", "flash-crash"],
                        }
                    },
                },
            },
            {
                "name": "get_leaderboard",
                "description": "Returns the live multi-agent leaderboard with Equity, PnL, Max Drawdown, PSR(0), and ACS score.",
                "inputSchema": {"type": "object", "properties": {}},
            },
            {
                "name": "verify_determinism",
                "description": "Executes a 5-run SHA-256 bit-for-bit state hash equivalence verification.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "seed": {"type": "integer", "default": 42},
                        "ticks": {"type": "integer", "default": 200},
                    },
                },
            },
        ]

    def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        args = arguments or {}

        if name == "get_market_digest":
            adv = int(args.get("advance_ticks", 0))
            if adv > 0:
                self.engine.step_n(adv)
            payload = self.engine.macro_digest()
            payload["state_hash"] = self.engine.state_hash()
            return self._wrap_tool_result(payload)

        if name == "get_orderbook_l2":
            depth = int(args.get("depth", 5))
            snap = self.engine.telemetry(depth=depth)
            return self._wrap_tool_result(
                {
                    "tick": snap["tick"],
                    "regime": snap["regime"],
                    "book": snap["book"],
                    "state_hash": snap["state_hash"],
                }
            )

        if name == "submit_clob_order":
            outcome = self.engine.submit_order(
                agent_id=str(args["agent_id"]),
                side=str(args["side"]),
                order_type=str(args["order_type"]),
                price_pips=to_pips(float(args["price"])),
                qty_pips=to_pips(float(args["qty"])),
            )
            return self._wrap_tool_result(
                {
                    "outcome": outcome,
                    "state_hash": self.engine.state_hash(),
                }
            )

        if name == "execute_evm_swap":
            event = self.engine.execute_amm_swap(
                agent_id=str(args["agent_id"]),
                zero_for_one=bool(args["zero_for_one"]),
                amount_in_pips=to_pips(float(args["amount_in"])),
            )
            return self._wrap_tool_result(
                {
                    "evm_trace_event": event,
                    "state_hash": self.engine.state_hash(),
                }
            )

        if name == "trigger_chaos_regime":
            regime = str(args.get("regime", "flash-crash"))
            if regime == "flash-crash":
                self.engine.trigger_flash_crash()
            else:
                self.engine.set_regime(regime)
            return self._wrap_tool_result(
                {
                    "regime": self.engine.regime,
                    "tick": self.engine.tick,
                    "state_hash": self.engine.state_hash(),
                }
            )

        if name == "get_leaderboard":
            return self._wrap_tool_result(
                {
                    "tick": self.engine.tick,
                    "leaderboard": self.engine.leaderboard(),
                    "state_hash": self.engine.state_hash(),
                }
            )

        if name == "verify_determinism":
            seed = int(args.get("seed", 42))
            ticks = int(args.get("ticks", 200))
            ok, hashes = verify_determinism(seed=seed, ticks=ticks, runs=5)
            return self._wrap_tool_result(
                {
                    "seed": seed,
                    "ticks": ticks,
                    "runs": 5,
                    "bit_for_bit_equal": ok,
                    "sha256_hashes": hashes,
                }
            )

        raise ValueError(f"Unknown MCP tool: {name}")

    def handle_jsonrpc(self, request: dict[str, Any]) -> dict[str, Any] | None:
        method = request.get("method", "")
        req_id = request.get("id")
        params = request.get("params") or {}

        if method == "notifications/initialized":
            return None

        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "serverInfo": {"name": "apex-arena-mcp", "version": "0.1.0"},
                    "capabilities": {"tools": {}},
                },
            }

        if method == "ping":
            return {"jsonrpc": "2.0", "id": req_id, "result": {}}

        if method == "tools/list":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"tools": self.list_tools()},
            }

        if method == "tools/call":
            tool_name = str(params.get("name", ""))
            tool_args = params.get("arguments") or {}
            try:
                result = self.call_tool(tool_name, tool_args)
                return {"jsonrpc": "2.0", "id": req_id, "result": result}
            except Exception as exc:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32602, "message": str(exc)},
                }

        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }

    @staticmethod
    def _wrap_tool_result(data: dict[str, Any]) -> dict[str, Any]:
        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(data, indent=2),
                }
            ],
            "structuredContent": data,
            "isError": False,
        }


def run_stdio_server() -> None:
    seed = int(os.environ.get("APEX_DEFAULT_SEED", "42"))
    server = ApexMcpServer(seed=seed)
    for line in sys.stdin:
        stripped = line.strip()
        if not stripped:
            continue
        try:
            req = json.loads(stripped)
            resp = server.handle_jsonrpc(req)
            if resp is not None:
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()
        except Exception as exc:
            err_resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": f"Parse error: {exc}"},
            }
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    run_stdio_server()
