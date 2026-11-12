"use client";

import { Badge, ConceptPill, Panel } from "../ui";
import { CopyButton, JsonView } from "./JsonView";
import { SCALE, type FrozenDigest } from "./model";
import styles from "./Lab.module.css";

export function DigestPanel({ digest, onFreeze }: { digest: FrozenDigest | null; onFreeze: () => void }) {
  const d = digest?.json;
  return (
    <Panel
      title="Live MacroDigest"
      subtitle="The exact payload a reasoning agent receives from get_market_digest"
      actions={
        <>
          {d ? <CopyButton value={d} what="MacroDigest JSON" /> : null}
          <button type="button" className="btn btn-sm btn-evm" onClick={onFreeze}>
            Freeze now
          </button>
        </>
      }
      explain={{
        what: (
          <>
            A deterministic snapshot of both venues, compiled at the macro barrier. The top-level fields match the Rust{" "}
            <code className="mono">MacroDigest</code> struct that the Python MCP server returns from{" "}
            <code className="mono">get_market_digest</code>, with <code className="mono">state_hash</code> appended. The nested{" "}
            <code className="mono">clob</code>, <code className="mono">amm</code> and <code className="mono">basis_bps</code> blocks are
            workstation extensions that show the top of book and pool reserves the agent reasons over.
          </>
        ),
        how: (
          <>
            The digest refreshes automatically every time the arena crosses a barrier. Press Freeze now to snapshot the current tick
            instead, then Copy to paste it into your own agent or an LLM prompt.
          </>
        ),
        math: (
          <>
            Every price is an integer number of pips: 1.0 = 100,000,000 (SCALE = 10⁸), so{" "}
            <span className="mono">clob_mid_price / 10⁸</span> is the USD mid. No floats ever touch the kernel, which is why the same seed
            always yields the same <span className="mono">state_hash</span>.
          </>
        ),
      }}
    >
      {d && digest ? (
        <div className="stack" style={{ ["--gap" as string]: "12px" }}>
          <div className={styles.digestMeta}>
            <Badge tone={digest.source === "barrier" ? "chaos" : "evm"}>
              {digest.source === "barrier" ? "Frozen at barrier" : digest.source === "manual" ? "Frozen manually" : "Snapshot on open"}
            </Badge>
            <span className="caption">
              epoch <span className="num">{d.epoch_index}</span> · tick <span className="num">{d.tick.toLocaleString("en-US")}</span> ·
              mid <span className="num">${(d.clob_mid_price / SCALE).toFixed(2)}</span>
            </span>
            <span className="grow" />
            <ConceptPill concept="fixedPoint" label="Why integers?" align="right" />
          </div>
          <JsonView value={d} label={`MacroDigest JSON for epoch ${d.epoch_index}`} />
        </div>
      ) : (
        <div className="empty">The first digest appears when the arena crosses its next 100-tick barrier, or press Freeze now.</div>
      )}
    </Panel>
  );
}
