/**
 * Client for the Rust kernel compiled to WebAssembly (crates/apex-wasm).
 * It runs in a dedicated module Web Worker so a 20,000-tick check never blocks the UI.
 */

export const SEED_MAX = 4_294_967_295;
export const TICKS_MIN = 1;
export const TICKS_MAX = 20_000;

/** Scenario names accepted by `apex-tui --scenario` (mirrors src/app/api/arena/route.ts). */
export const WASM_SCENARIOS = ["calm", "trending", "drought", "flash-crash"] as const;
const SCENARIO_ALIASES: Record<string, (typeof WASM_SCENARIOS)[number]> = {
  calm: "calm",
  trending: "trending",
  trend: "trending",
  drought: "drought",
  "liquidity-drought": "drought",
  "flash-crash": "flash-crash",
  flash_crash: "flash-crash",
  crash: "flash-crash",
};

export type RustWasmRequest =
  | { id: number; op: "verify"; base: string; seed: number; ticks: number }
  | { id: number; op: "snapshot"; base: string; seed: number; ticks: number; scenario: string };
export type RustWasmReply = { id: number; ok: true; json: string; execMs: number } | { id: number; ok: false; error: string; phase?: "load" | "run" };

export class WasmInputError extends Error {}
export class WasmLoadError extends Error {}

function intInRange(v: unknown, dflt: number, min: number, max: number, name: string): number {
  if (v === undefined || v === null || v === "") return dflt;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new WasmInputError(`${name} must be an integer.`);
  if (n < min || n > max) throw new WasmInputError(`${name} must be between ${min.toLocaleString("en-US")} and ${max.toLocaleString("en-US")}.`);
  return n;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (r: RustWasmReply) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL("../workers/rust.worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (ev: MessageEvent<RustWasmReply>) => {
    const p = pending.get(ev.data.id);
    if (p) {
      pending.delete(ev.data.id);
      p.resolve(ev.data);
    }
  };
  w.onerror = (ev) => {
    const msg = ev.message || "The Rust WebAssembly worker crashed.";
    for (const [id, p] of pending) p.resolve({ id, ok: false, error: msg, phase: "load" });
    pending.clear();
    w.terminate();
    worker = null;
  };
  worker = w;
  return w;
}

function call(req: Omit<RustWasmRequest, "id" | "base"> & Record<string, unknown>): Promise<RustWasmReply> {
  const id = ++seq;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return new Promise((resolve) => {
    pending.set(id, { resolve });
    try {
      getWorker().postMessage({ ...req, id, base });
    } catch (err) {
      pending.delete(id);
      resolve({ id, ok: false, error: err instanceof Error ? err.message : String(err), phase: "load" });
    }
  });
}

export const WASM_ENGINE = "rust-wasm";
export const WASM_ENGINE_LABEL = "Rust apex-kernel compiled to WebAssembly, running in this browser";

/**
 * Runs one of the two Rust actions in WebAssembly. Resolves with the same body shape as POST /api/arena
 * (`ok: true, engine, command, execMs, ...`) or throws WasmInputError / WasmLoadError / Error.
 */
export async function runRustWasm(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = String(body.action);
  const seed = intInRange(body.seed, 42, 0, SEED_MAX, "seed");
  if (action === "verify_rust_determinism") {
    const ticks = intInRange(body.ticks, 300, TICKS_MIN, TICKS_MAX, "ticks");
    const r = await call({ op: "verify", seed, ticks });
    if (!r.ok) throw r.phase === "run" ? new Error(r.error) : new WasmLoadError(r.error);
    return {
      ok: true,
      engine: WASM_ENGINE,
      engineLabel: WASM_ENGINE_LABEL,
      command: `apex_wasm.verify_determinism(${seed}n, ${ticks}) — same kernel as apex-tui --verify-determinism`,
      execMs: r.execMs,
      ...(JSON.parse(r.json) as Record<string, unknown>),
    };
  }
  if (action === "rust_snapshot") {
    const ticks = intInRange(body.ticks, 250, TICKS_MIN, TICKS_MAX, "ticks");
    const rawScenario = String(body.scenario ?? "flash-crash").toLowerCase().trim();
    const scenario = SCENARIO_ALIASES[rawScenario];
    if (!scenario) throw new WasmInputError(`Unknown scenario "${rawScenario}". Use one of: ${WASM_SCENARIOS.join(", ")}.`);
    const r = await call({ op: "snapshot", seed, ticks, scenario });
    if (!r.ok) throw r.phase === "run" ? new Error(r.error) : new WasmLoadError(r.error);
    const parsed = JSON.parse(r.json) as Record<string, unknown>;
    if (typeof parsed.error === "string") throw new WasmInputError(parsed.error);
    return {
      ok: true,
      engine: WASM_ENGINE,
      engineLabel: WASM_ENGINE_LABEL,
      command: `apex_wasm.snapshot("${scenario}", ${seed}n, ${ticks}) — same kernel as apex-tui --scenario ${scenario} --json`,
      scenario,
      seed,
      ticks,
      execMs: r.execMs,
      snapshot: parsed,
    };
  }
  throw new WasmInputError(`Action "${action}" is not available in WebAssembly.`);
}

export const isWasmAction = (a: unknown) => a === "verify_rust_determinism" || a === "rust_snapshot";
