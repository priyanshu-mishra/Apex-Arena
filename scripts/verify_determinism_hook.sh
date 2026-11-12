#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:/usr/local/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "========================================================================"
echo "[ApexArena Gate] Running 5-Pass Bit-for-Bit Determinism Verification..."
echo "========================================================================"

if grep -rnE "SystemTime::now|Instant::now|thread_rng" crates/apex-types crates/apex-clob crates/apex-evm crates/apex-kernel >/dev/null 2>&1; then
  echo "[ERROR] Wall-clock or unseeded RNG call detected in deterministic core crates!"
  exit 1
fi

if grep -rnE "std::collections::(HashMap|HashSet)" crates/apex-types crates/apex-clob crates/apex-evm crates/apex-kernel >/dev/null 2>&1; then
  echo "[ERROR] Non-deterministic HashMap/HashSet detected in core crates! Use BTreeMap/BTreeSet."
  exit 1
fi

cargo test --test determinism_suite -- --nocapture

echo "[ApexArena Gate] PASS: 5-Run SHA-256 State Equivalence Verified."
