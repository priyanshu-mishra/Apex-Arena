#!/usr/bin/env bash
# Build the apex-wasm crate and emit browser-loadable bindings into apps/web-arena/public/wasm/.
# Needs: rustup toolchain with wasm32-unknown-unknown, and wasm-bindgen-cli matching Cargo.lock.
set -euo pipefail
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.."
OUT="apps/web-arena/public/wasm"
want=$(awk '/^name = "wasm-bindgen"$/{getline; gsub(/[^0-9.]/,"",$0); print; exit}' Cargo.lock)
have=$(wasm-bindgen --version | awk '{print $2}')
[ "$want" = "$have" ] || { echo "wasm-bindgen-cli $have != crate $want (cargo install wasm-bindgen-cli --version $want --locked)" >&2; exit 1; }
cargo build -p apex-wasm --release --target wasm32-unknown-unknown --locked
rm -rf "$OUT"; mkdir -p "$OUT"
wasm-bindgen --target web --out-dir "$OUT" --out-name apex_wasm target/wasm32-unknown-unknown/release/apex_wasm.wasm
if command -v wasm-opt >/dev/null; then wasm-opt -Oz "$OUT/apex_wasm_bg.wasm" -o "$OUT/apex_wasm_bg.wasm"; fi
ls -l "$OUT"
