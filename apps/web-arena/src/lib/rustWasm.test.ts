import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import real from "./canyon/real.json";
import { REFERENCE_HASH_SEED42_T300 } from "../components/arch/InvariantsList";

const wasmDir = fileURLToPath(new URL("../../public/wasm/", import.meta.url));
const wasmPath = `${wasmDir}apex_wasm_bg.wasm`;
const hasWasm = existsSync(wasmPath) && existsSync(`${wasmDir}apex_wasm.js`);

// skipIf prints the skip in the reporter; the reason is the describe name.
describe.skipIf(!hasWasm)("Rust kernel compiled to WebAssembly (skipped: run scripts/build-wasm.sh to build public/wasm)", () => {
  it("5-run verification at seed 42 / 300 ticks matches real.json and the reference hash", async () => {
    const mod = await import(/* @vite-ignore */ `${wasmDir}apex_wasm.js`);
    mod.initSync({ module: readFileSync(wasmPath) });
    const out = JSON.parse(mod.verify_determinism(42n, 300));
    expect(out.all_equal).toBe(true);
    expect(out.hashes).toHaveLength(5);
    for (const h of out.hashes) {
      expect(h).toBe(real.hash);
      expect(h).toBe(REFERENCE_HASH_SEED42_T300);
    }
    const snap = JSON.parse(mod.snapshot("flash-crash", 42n, 250));
    expect(snap.state_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(mod.snapshot("nope", 42n, 10)).error).toBeTruthy();
  });
});

describe("postArena routing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("./rustWasm");
  });

  async function load(staticDemo: boolean) {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_STATIC_DEMO", staticDemo ? "true" : "false");
    const runRustWasm = vi.fn(async (b: Record<string, unknown>) => ({ ok: true, engine: "rust-wasm", action: b.action, execMs: 3 }));
    vi.doMock("./rustWasm", async (orig) => ({ ...(await orig<typeof import("./rustWasm")>()), runRustWasm }));
    const api = await import("../components/arch/verifyApi");
    return { api, runRustWasm };
  }

  it("static demo sends Rust actions to WebAssembly without touching fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { api, runRustWasm } = await load(true);
    const r = await api.postArena<{ engine: string }>({ action: "verify_rust_determinism", seed: 42, ticks: 300 });
    expect(r.ok && r.data.engine).toBe("rust-wasm");
    expect(runRustWasm).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("static demo keeps Python MCP unavailable with an honest message", async () => {
    const { api, runRustWasm } = await load(true);
    const r = await api.postArena({ action: "mcp_call", toolName: "get_leaderboard" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Python MCP/);
    expect(runRustWasm).not.toHaveBeenCalled();
  });

  it("server path is used first outside the static demo", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, engine: "native" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { api, runRustWasm } = await load(false);
    const r = await api.postArena<{ engine: string }>({ action: "rust_snapshot", seed: 42 });
    expect(r.ok && r.data.engine).toBe("native");
    expect(runRustWasm).not.toHaveBeenCalled();
  });

  it("falls back to WebAssembly when the server has no route or binary, and says so", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "binary missing" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const { api, runRustWasm } = await load(false);
    const r = await api.postArena<{ engine: string; note?: string }>({ action: "verify_rust_determinism", seed: 42, ticks: 300 });
    expect(runRustWasm).toHaveBeenCalledOnce();
    expect(r.ok && r.data.engine).toBe("rust-wasm");
    expect(r.ok && r.data.note).toMatch(/WebAssembly/);
  });

  it("falls back when the server cannot be reached, but not for MCP calls", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const { api, runRustWasm } = await load(false);
    const ok = await api.postArena({ action: "rust_snapshot" });
    expect(ok.ok).toBe(true);
    const mcp = await api.postArena({ action: "tools_list" });
    expect(mcp.ok).toBe(false);
    expect(runRustWasm).toHaveBeenCalledOnce();
  });

  it("does not fall back on a 400 validation error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "bad seed" }), { status: 400 })));
    const { api, runRustWasm } = await load(false);
    const r = await api.postArena({ action: "rust_snapshot", seed: -1 });
    expect(r.ok).toBe(false);
    expect(runRustWasm).not.toHaveBeenCalled();
  });
});
