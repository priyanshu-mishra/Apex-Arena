/// <reference lib="webworker" />
/**
 * Runs the real Rust kernel (crates/apex-wasm, built by scripts/build-wasm.sh) off the main thread.
 * The bundler never sees the wasm-bindgen glue: it is loaded from /public/wasm with a runtime import.
 */
import type { RustWasmRequest, RustWasmReply } from "../lib/rustWasm";

interface WasmApi {
  default: (init: { module_or_path: string }) => Promise<unknown>;
  verify_determinism: (seed: bigint, ticks: number) => string;
  snapshot: (scenario: string, seed: bigint, ticks: number) => string;
  version?: () => string;
}

let loading: Promise<WasmApi> | null = null;

function load(base: string): Promise<WasmApi> {
  if (!loading) {
    loading = (async () => {
      const root = `${self.location.origin}${base}/wasm`;
      const mod = (await import(/* webpackIgnore: true */ `${root}/apex_wasm.js`)) as WasmApi;
      await mod.default({ module_or_path: `${root}/apex_wasm_bg.wasm` });
      return mod;
    })();
    loading.catch(() => {
      loading = null; // allow a retry after a failed load
    });
  }
  return loading;
}

self.onmessage = async (ev: MessageEvent<RustWasmRequest>) => {
  const req = ev.data;
  const post = (r: RustWasmReply) => (self as unknown as Worker).postMessage(r);
  try {
    const api = await load(req.base);
    const t0 = performance.now();
    const json = req.op === "verify" ? api.verify_determinism(BigInt(req.seed), req.ticks) : api.snapshot(req.scenario, BigInt(req.seed), req.ticks);
    post({ id: req.id, ok: true, json, execMs: Math.max(1, Math.round(performance.now() - t0)) });
  } catch (err) {
    post({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err), phase: loading ? "run" : "load" });
  }
};
