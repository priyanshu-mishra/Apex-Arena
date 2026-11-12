"""Unit and integration tests for the ApexArena Python SDK and MCP Server Bridge."""

from __future__ import annotations

from apex_arena import (
     SCALE,
    ApexMcpServer,
    ArenaEngine,
    HybridLLMMarketMaker,
    run_agent_simulation,
    verify_determinism,
)


def test_pyo3_five_run_determinism() -> None:
    all_equal, hashes = verify_determinism(seed=42, ticks=250, runs=5)
    assert all_equal is True
    assert len(hashes) == 5
    assert len(set(hashes)) == 1
    assert len(hashes[0]) == 64


def test_arena_engine_order_and_revm_swap() -> None:
    engine = ArenaEngine(seed=99, regime="calm")
    h1 = engine.step_n(25)
    assert len(h1) == 64

    outcome = engine.submit_order(
        agent_id="PyQuant-1",
        side="BID",
        order_type="LIMIT",
        price_pips=2235 * SCALE,
        qty_pips=2 * SCALE,
    )
    assert outcome["rested_qty"] == 2 * SCALE
    assert outcome["self_trade_prevented"] is False

    swap_event = engine.execute_amm_swap(
        agent_id="PyQuant-1",
        zero_for_one=True,
        amount_in_pips=3 * SCALE,
    )
    assert swap_event["amount_in"] == 3 * SCALE
    assert swap_event["amount_out"] > 0
    assert "SWAP" in swap_event["log_line"]


def test_hybrid_llm_market_maker_simulation() -> None:
    agent1 = HybridLLMMarketMaker(agent_id="Hybrid-LLM-MM", base_spread_bps=10)
    res1 = run_agent_simulation(agent1, seed=77, regime="flash-crash", ticks=200)

    agent2 = HybridLLMMarketMaker(agent_id="Hybrid-LLM-MM", base_spread_bps=10)
    res2 = run_agent_simulation(agent2, seed=77, regime="flash-crash", ticks=200)

    assert res1["final_state_hash"] == res2["final_state_hash"]
    assert res1["submitted_orders"] > 0
    assert res1["macro_updates"] == 2


def test_mcp_server_jsonrpc_tools() -> None:
    mcp = ApexMcpServer(seed=42, regime="calm")

    init_resp = mcp.handle_jsonrpc({"jsonrpc": "2.0", "id": 1, "method": "initialize"})
    assert init_resp is not None
    assert init_resp["result"]["serverInfo"]["name"] == "apex-arena-mcp"

    tools_resp = mcp.handle_jsonrpc({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    assert tools_resp is not None
    tool_names = {t["name"] for t in tools_resp["result"]["tools"]}
    assert {
        "get_market_digest",
        "get_orderbook_l2",
        "submit_clob_order",
        "execute_evm_swap",
        "trigger_chaos_regime",
        "get_leaderboard",
        "verify_determinism",
    }.issubset(tool_names)

    digest_call = mcp.handle_jsonrpc(
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "get_market_digest", "arguments": {"advance_ticks": 15}},
        }
    )
    assert digest_call is not None
    structured = digest_call["result"]["structuredContent"]
    assert structured["tick"] == 35
    assert len(structured["state_hash"]) == 64

    shock_call = mcp.handle_jsonrpc(
        {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {"name": "trigger_chaos_regime", "arguments": {"regime": "flash-crash"}},
        }
    )
    assert shock_call is not None
    assert shock_call["result"]["structuredContent"]["regime"] == "FLASH CRASH"
