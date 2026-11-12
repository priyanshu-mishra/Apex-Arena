import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getRepoRoot(): string {
  return path.resolve(process.cwd(), "../..");
}

function getBuildEnv(): NodeJS.ProcessEnv {
  const home = process.env.HOME || "/Users/priyanshum";
  return {
    ...process.env,
    PATH: `/opt/homebrew/bin:${home}/.cargo/bin:/usr/local/bin:${process.env.PATH || ""}`,
    PYTHONPATH: path.join(getRepoRoot(), "sdks/python"),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action as string;
    const repoRoot = getRepoRoot();
    const env = getBuildEnv();
    const rustBin = path.join(repoRoot, "target/debug/apex-tui");

    if (action === "verify_rust_determinism") {
      const seed = Number(body?.seed ?? 42);
      const ticks = Number(body?.ticks ?? 300);

      const { stdout } = await execFileAsync(
        rustBin,
        ["--verify-determinism", "--seed", String(seed), "--ticks", String(ticks)],
        { cwd: repoRoot, env, timeout: 15000 }
      );
      const parsed = JSON.parse(stdout);
      return NextResponse.json({
        ok: true,
        engine: "Rust apex-kernel (Native Fixed-Point SCALE=10^8)",
        ...parsed,
      });
    }

    if (action === "rust_snapshot") {
      const seed = Number(body?.seed ?? 42);
      const ticks = Number(body?.ticks ?? 250);
      const scenario = String(body?.scenario ?? "flash-crash");

      const { stdout } = await execFileAsync(
        rustBin,
        [
          "--scenario",
          scenario,
          "--seed",
          String(seed),
          "--ticks",
          String(ticks),
          "--json",
        ],
        { cwd: repoRoot, env, timeout: 15000 }
      );
      const snapshot = JSON.parse(stdout);
      return NextResponse.json({
        ok: true,
        engine: "Rust apex-kernel (Native Fixed-Point SCALE=10^8)",
        snapshot,
      });
    }

    if (action === "mcp_call") {
      const toolName = String(body?.toolName ?? "get_market_digest");
      const toolArgs = body?.toolArgs ?? {};
      const seed = Number(body?.seed ?? 42);

      const pyScript = `
import json, sys
from apex_arena.mcp_server import ApexMcpServer
srv = ApexMcpServer(seed=${seed}, regime="calm")
req = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": ${JSON.stringify(toolName)}, "arguments": ${JSON.stringify(toolArgs)}}}
resp = srv.handle_jsonrpc(req)
print(json.dumps({"request": req, "response": resp}))
`;
      const { stdout } = await execFileAsync("python3", ["-c", pyScript], {
        cwd: repoRoot,
        env,
        timeout: 15000,
      });
      const result = JSON.parse(stdout.trim());
      return NextResponse.json({
        ok: true,
        engine: "Python PyO3 + MCP Server (apex_arena._core)",
        ...result,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unsupported action: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
