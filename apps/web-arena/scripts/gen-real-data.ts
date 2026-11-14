// Generates src/lib/canyon/real.json from the compiled Rust binary. Never fails the build.
// It writes only a proven run: all_equal and five identical hashes, else the existing file stays.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTui, proofRefusal } from "../src/lib/canyon/parse";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bin = process.env.APEX_TUI_BIN ?? resolve(root, "../../target/debug/apex-tui");
const out = resolve(root, "src/lib/canyon/real.json");

function run(args: string[]): unknown {
  return JSON.parse(execFileSync(bin, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
}

function main() {
  if (!existsSync(bin)) {
    console.log("gen:real: apex-tui not found, keeping existing real.json");
    return;
  }
  const snapshot = run(["--scenario", "flash-crash", "--seed", "42", "--ticks", "300", "--json"]);
  const verify = run(["--verify-determinism", "--seed", "42", "--ticks", "300"]);
  const refusal = proofRefusal(verify);
  if (refusal) {
    console.log(`gen:real: ${refusal}; keeping existing real.json`);
    return;
  }
  let calm: unknown;
  try {
    calm = run(["--scenario", "calm", "--seed", "42", "--ticks", "300", "--json"]);
  } catch {
    calm = undefined; // parseTui falls back to 0.20
  }
  const next = JSON.stringify(parseTui(snapshot, verify, calm), null, 2) + "\n";
  const prev = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (next !== prev) {
    writeFileSync(out, next);
    console.log("gen:real: updated real.json");
  } else {
    console.log("gen:real: real.json is up to date");
  }
}

try {
  main();
} catch (err) {
  console.log(`gen:real: ${(err as Error).message}; keeping existing real.json`);
}
