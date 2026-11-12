import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Live verification bridge: the browser asks, the native Rust binary and the
 * Python MCP server answer.
 *
 * Actions (all POST, JSON body):
 *   verify_rust_determinism { seed?, ticks? }            → apex-tui --verify-determinism
 *   rust_snapshot           { scenario?, seed?, ticks? } → apex-tui --scenario … --json
 *   mcp_call                { toolName, toolArgs?, seed?, regime? } → ApexMcpServer tools/call
 *   tools_list              { seed? }                    → ApexMcpServer tools/list
 *
 * Every input is validated against an allow-list or clamped to a safe range
 * before it reaches a child process. Responses always carry `ok` and
 * `elapsedMs`; failures add an actionable `error` and, where useful, a `hint`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEED_MAX = 2 ** 32 - 1;
const TICKS_MIN = 1;
const TICKS_MAX = 20_000;
const CHILD_TIMEOUT_MS = 20_000;

/** Scenario names accepted by `apex-tui --scenario` (see crates/apex-tui/src/main.rs parse_regime). */
const RUST_SCENARIOS = ["calm", "trending", "drought", "flash-crash"] as const;
const SCENARIO_ALIASES: Record<string, (typeof RUST_SCENARIOS)[number]> = {
  calm: "calm",
  trending: "trending",
  trend: "trending",
  drought: "drought",
  "liquidity-drought": "drought",
  "flash-crash": "flash-crash",
  flash_crash: "flash-crash",
  crash: "flash-crash",
};

/** Tools exposed by sdks/python/apex_arena/mcp_server.py ApexMcpServer.list_tools(). */
const MCP_TOOLS = [
  "get_market_digest",
  "get_orderbook_l2",
  "submit_clob_order",
  "execute_evm_swap",
  "trigger_chaos_regime",
  "get_leaderboard",
  "verify_determinism",
] as const;

const MCP_REGIMES = ["calm", "trending", "liquidity-drought", "flash-crash"] as const;

class BadRequest extends Error {}

function getRepoRoot(): string {
  return path.resolve(process.cwd(), "../..");
}

function getBuildEnv(): NodeJS.ProcessEnv {
  const home = process.env.HOME || "";
  return {
    ...process.env,
    PATH: `/opt/homebrew/bin:${home}/.cargo/bin:/usr/local/bin:${process.env.PATH || ""}`,
    PYTHONPATH: path.join(getRepoRoot(), "sdks/python"),
  };
}

function intInRange(raw: unknown, fallback: number, min: number, max: number, name: string): number {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) throw new BadRequest(`${name} must be a number (got ${JSON.stringify(raw)}).`);
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

function run(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { cwd, env, timeout: CHILD_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const e = err as NodeJS.ErrnoException & { code?: number | string; killed?: boolean };
          if (e.code === "ENOENT") return reject(err);
          if (e.killed) return reject(new Error(`${path.basename(cmd)} timed out after ${CHILD_TIMEOUT_MS / 1000}s.`));
          // Non-zero exit: still hand back stdout (apex-tui exits 1 when hashes differ).
          return resolve({ stdout: String(stdout), stderr: String(stderr), code: typeof e.code === "number" ? e.code : 1 });
        }
        resolve({ stdout: String(stdout), stderr: String(stderr), code: 0 });
      }
    );
  });
}

function parseJson(stdout: string, source: string, stderr: string): unknown {
  try {
    return JSON.parse(stdout.trim());
  } catch {
    const tail = (stderr || stdout).trim().split("\n").slice(-6).join("\n");
    throw new Error(`${source} did not return valid JSON.${tail ? `\n${tail}` : ""}`);
  }
}

function fail(status: number, error: string, started: number, hint?: string) {
  return NextResponse.json({ ok: false, error, hint, elapsedMs: Date.now() - started }, { status });
}

const PY_BRIDGE = `
import json, sys
try:
    from apex_arena.mcp_server import ApexMcpServer
except Exception as exc:
    print(json.dumps({"bridge_error": "import", "detail": repr(exc)}))
    sys.exit(0)
payload = json.loads(sys.argv[1])
srv = ApexMcpServer(seed=payload["seed"], regime=payload["regime"])
req = payload["request"]
resp = srv.handle_jsonrpc(req)
print(json.dumps({"request": req, "response": resp}))
`;

async function callMcp(
  request: Record<string, unknown>,
  seed: number,
  regime: string,
  repoRoot: string,
  env: NodeJS.ProcessEnv
): Promise<{ request: unknown; response: unknown }> {
  const payload = JSON.stringify({ seed, regime, request });
  let res: ExecResult;
  try {
    res = await run("python3", ["-c", PY_BRIDGE, payload], repoRoot, env);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw Object.assign(new Error("python3 was not found on PATH."), {
        hint: "Install Python 3.9+ and make sure `python3` is on the PATH of the process running `bun run dev`.",
        status: 503,
      });
    }
    throw err;
  }
  const parsed = parseJson(res.stdout, "The Python MCP bridge", res.stderr) as Record<string, unknown>;
  if (parsed && parsed.bridge_error === "import") {
    throw Object.assign(new Error(`Could not import apex_arena: ${String(parsed.detail)}`), {
      hint: "Build the PyO3 extension so sdks/python/apex_arena/_core.abi3.so exists (e.g. `cd crates/apex-py && maturin develop`, or copy the built cdylib into sdks/python/apex_arena/).",
      status: 503,
    });
  }
  return parsed as { request: unknown; response: unknown };
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  let body: Record<string, unknown>;
  try {
    const raw = await req.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error();
    body = raw as Record<string, unknown>;
  } catch {
    return fail(400, "Request body must be a JSON object, e.g. {\"action\":\"verify_rust_determinism\"}.", started);
  }

  const action = String(body.action ?? "");
  const repoRoot = getRepoRoot();
  const env = getBuildEnv();
  const rustBin = path.join(repoRoot, "target/debug/apex-tui");

  try {
    if (action === "verify_rust_determinism" || action === "rust_snapshot") {
      if (!existsSync(rustBin)) {
        return fail(
          503,
          "The native Rust binary target/debug/apex-tui has not been built yet.",
          started,
          "Run `cargo build -p apex-tui` from the repository root, then try again."
        );
      }
    }

    if (action === "verify_rust_determinism") {
      const seed = intInRange(body.seed, 42, 0, SEED_MAX, "seed");
      const ticks = intInRange(body.ticks, 300, TICKS_MIN, TICKS_MAX, "ticks");
      const args = ["--verify-determinism", "--seed", String(seed), "--ticks", String(ticks)];
      const t0 = Date.now();
      const res = await run(rustBin, args, repoRoot, env);
      const execMs = Date.now() - t0;
      const parsed = parseJson(res.stdout, "apex-tui", res.stderr) as Record<string, unknown>;
      return NextResponse.json({
        ok: true,
        engine: "Rust apex-kernel (Native Fixed-Point SCALE=10^8)",
        command: `target/debug/apex-tui ${args.join(" ")}`,
        exitCode: res.code,
        execMs,
        elapsedMs: Date.now() - started,
        ...parsed,
      });
    }

    if (action === "rust_snapshot") {
      const seed = intInRange(body.seed, 42, 0, SEED_MAX, "seed");
      const ticks = intInRange(body.ticks, 250, TICKS_MIN, TICKS_MAX, "ticks");
      const rawScenario = String(body.scenario ?? "flash-crash").toLowerCase().trim();
      const scenario = SCENARIO_ALIASES[rawScenario];
      if (!scenario) {
        throw new BadRequest(`Unknown scenario "${rawScenario}". Use one of: ${RUST_SCENARIOS.join(", ")}.`);
      }
      const args = ["--scenario", scenario, "--seed", String(seed), "--ticks", String(ticks), "--json"];
      const t0 = Date.now();
      const res = await run(rustBin, args, repoRoot, env);
      const execMs = Date.now() - t0;
      if (res.code !== 0) {
        throw new Error(`apex-tui exited with code ${res.code}. ${res.stderr.trim().split("\n").slice(-4).join(" ")}`);
      }
      const snapshot = parseJson(res.stdout, "apex-tui", res.stderr);
      return NextResponse.json({
        ok: true,
        engine: "Rust apex-kernel (Native Fixed-Point SCALE=10^8)",
        command: `target/debug/apex-tui ${args.join(" ")}`,
        scenario,
        seed,
        ticks,
        execMs,
        elapsedMs: Date.now() - started,
        snapshot,
      });
    }

    if (action === "mcp_call" || action === "tools_list") {
      const seed = intInRange(body.seed, 42, 0, SEED_MAX, "seed");
      const regime = String(body.regime ?? "calm");
      if (!(MCP_REGIMES as readonly string[]).includes(regime)) {
        throw new BadRequest(`Unknown regime "${regime}". Use one of: ${MCP_REGIMES.join(", ")}.`);
      }

      let request: Record<string, unknown>;
      if (action === "tools_list") {
        request = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
      } else {
        const toolName = String(body.toolName ?? "get_market_digest");
        if (!(MCP_TOOLS as readonly string[]).includes(toolName)) {
          throw new BadRequest(`Unknown MCP tool "${toolName}". Available tools: ${MCP_TOOLS.join(", ")}.`);
        }
        const toolArgs = body.toolArgs ?? {};
        if (typeof toolArgs !== "object" || toolArgs === null || Array.isArray(toolArgs)) {
          throw new BadRequest("toolArgs must be a JSON object, e.g. {\"advance_ticks\": 100}.");
        }
        if (JSON.stringify(toolArgs).length > 8_192) {
          throw new BadRequest("toolArgs is too large (8 KB max).");
        }
        // Keep heavy tools bounded so a browser request cannot pin the server.
        const args = { ...(toolArgs as Record<string, unknown>) };
        if (toolName === "get_market_digest" && args.advance_ticks !== undefined) {
          args.advance_ticks = intInRange(args.advance_ticks, 0, 0, TICKS_MAX, "advance_ticks");
        }
        if (toolName === "verify_determinism" && args.ticks !== undefined) {
          args.ticks = intInRange(args.ticks, 200, TICKS_MIN, TICKS_MAX, "ticks");
        }
        if (toolName === "get_orderbook_l2" && args.depth !== undefined) {
          args.depth = intInRange(args.depth, 5, 1, 15, "depth");
        }
        request = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: toolName, arguments: args } };
      }

      const t0 = Date.now();
      const result = await callMcp(request, seed, regime, repoRoot, env);
      const execMs = Date.now() - t0;
      return NextResponse.json({
        ok: true,
        engine: "Python PyO3 + MCP Server (apex_arena._core)",
        seed,
        regime,
        execMs,
        elapsedMs: Date.now() - started,
        ...result,
      });
    }

    return fail(
      400,
      `Unsupported action "${action}".`,
      started,
      "Use one of: verify_rust_determinism, rust_snapshot, mcp_call, tools_list."
    );
  } catch (err: unknown) {
    if (err instanceof BadRequest) return fail(400, err.message, started);
    const e = err as Error & { hint?: string; status?: number; code?: string };
    if (e.code === "ENOENT") {
      return fail(503, "The native Rust binary could not be started.", started, "Run `cargo build -p apex-tui` from the repository root.");
    }
    return fail(e.status ?? 500, e.message || String(err), started, e.hint);
  }
}
