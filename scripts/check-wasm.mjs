// Compares the WASM build against native `target/debug/apex-tui`. Usage: node scripts/check-wasm.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "apps/web-arena/public/wasm");
const mod = await import(path.join(dir, "apex_wasm.js"));
mod.initSync({ module: readFileSync(path.join(dir, "apex_wasm_bg.wasm")) });
const tui = path.join(root, "target/debug/apex-tui");
const native = (...a) => execFileSync(tui, a, { encoding: "utf8" }).trimEnd();

let bad = 0;
const cmp = (label, w, n) => {
  const ok = w.trimEnd() === n;
  if (!ok) bad++;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
};
for (const [seed, ticks] of [[42, 300], [7, 1000], [123456, 200], [4294967295, 150]]) {
  cmp(`verify seed=${seed} ticks=${ticks}`, mod.verify_determinism(BigInt(seed), ticks),
    native("--verify-determinism", "--seed", String(seed), "--ticks", String(ticks)));
}
for (const [sc, seed, ticks] of [["flash-crash", 42, 300], ["calm", 7, 1000], ["flash-crash", 123456, 200],
  ["trending", 99, 400], ["drought", 5, 250]]) {
  cmp(`snapshot ${sc} seed=${seed} ticks=${ticks}`, mod.snapshot(sc, BigInt(seed), ticks),
    native("--scenario", sc, "--seed", String(seed), "--ticks", String(ticks), "--json"));
}
if (!JSON.parse(mod.snapshot("whale-dump", 1n, 1)).error) { bad++; console.log("FAIL unknown scenario should error"); }
const v = JSON.parse(mod.verify_determinism(42n, 300));
if (v.hashes[0] !== "4ee5fa377dd4d01d6225c6dd5f4f8f7a2d9cda7db63319e71f3d1c1458725614" || !v.all_equal) { bad++; console.log("FAIL reference hash"); }
const s = JSON.parse(mod.snapshot("flash-crash", 42n, 300));
if (s.state_hash !== "00fc3c529208ae447851608436587ecc376277916cce35a7f2dd09cdba3087af") { bad++; console.log("FAIL reference snapshot hash"); }
for (const t of [300, 5000]) {
  const t0 = performance.now(); mod.verify_determinism(42n, t);
  console.log(`verify_determinism(42, ${t}): ${(performance.now() - t0).toFixed(0)} ms`);
}
process.exit(bad ? 1 : 0);
