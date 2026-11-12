"""Command-Line Interface (`apex`) for scaffolding, testing, and verifying strategies."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from .agent import HybridLLMMarketMaker, run_agent_simulation
from .engine import verify_determinism
from .mcp_server import run_stdio_server

HYBRID_TEMPLATE = '''"""Scaffolded ApexArena Hybrid LLM + Microstructure Market Maker."""

from apex_arena import HybridLLMMarketMaker, run_agent_simulation

if __name__ == "__main__":
    agent = HybridLLMMarketMaker(agent_id="Custom-Hybrid-MM", base_spread_bps=10)
    summary = run_agent_simulation(agent, seed=42, regime="flash-crash", ticks=300)
    print("Final SHA-256 State Hash:", summary["final_state_hash"])
    for row in summary["leaderboard"]:
        print(f"{row['agent_id']:15s} | PnL={row['pnl_bps']}bps | ACS={row['acs_score_bps']}bps | {row['status']}")
'''


def cmd_init(args: argparse.Namespace) -> int:
    out_path = Path(args.output)
    out_path.write_text(HYBRID_TEMPLATE, encoding="utf-8")
    print(f"[ApexArena] Scaffolded template '{args.template}' -> {out_path}")
    return 0


def cmd_test(args: argparse.Namespace) -> int:
    if args.tui:
        repo_root = Path(__file__).resolve().parents[3]
        cmd = [
            "cargo",
            "run",
            "-p",
            "apex-tui",
            "--",
            "--scenario",
            args.scenario,
            "--seed",
            str(args.seed),
            "--ticks",
            str(args.ticks),
        ]
        if args.headless:
            cmd.append("--headless")
        return subprocess.call(cmd, cwd=str(repo_root))

    agent = HybridLLMMarketMaker(agent_id="Hybrid-LLM-MM")
    result = run_agent_simulation(
        agent=agent,
        seed=args.seed,
        regime=args.scenario,
        ticks=args.ticks,
    )
    print(json.dumps(result, indent=2))
    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    ok, hashes = verify_determinism(seed=args.seed, ticks=args.ticks, runs=args.runs)
    for idx, h in enumerate(hashes, start=1):
        print(f"[Run {idx}] SHA-256: {h}")
    if not ok:
        print("[FAIL] Determinism check failed!", file=sys.stderr)
        return 1
    print(f"[PASS] {args.runs}-Run Bit-for-Bit SHA-256 Equivalence Verified.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="apex", description="ApexArena Quant & AI Agent CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init", help="Scaffold an agent strategy from a template")
    p_init.add_argument("--template", default="hybrid-llm-mm")
    p_init.add_argument("--output", default="strategy_agent.py")

    p_test = sub.add_parser("test", help="Run local scenario simulation or launch Ratatui TUI")
    p_test.add_argument("--scenario", default="flash-crash")
    p_test.add_argument("--seed", type=int, default=42)
    p_test.add_argument("--ticks", type=int, default=300)
    p_test.add_argument("--tui", action="store_true", help="Launch 4-quadrant Ratatui TUI")
    p_test.add_argument("--headless", action="store_true", help="Render TUI frame headlessly")

    p_verify = sub.add_parser("verify", help="Run 5-pass SHA-256 determinism verification")
    p_verify.add_argument("--seed", type=int, default=42)
    p_verify.add_argument("--ticks", type=int, default=300)
    p_verify.add_argument("--runs", type=int, default=5)

    sub.add_parser("mcp", help="Launch the Model Context Protocol (MCP) stdio server")

    parsed = parser.parse_args(argv)
    if parsed.command == "init":
        return cmd_init(parsed)
    if parsed.command == "test":
        return cmd_test(parsed)
    if parsed.command == "verify":
        return cmd_verify(parsed)
    if parsed.command == "mcp":
        run_stdio_server()
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
