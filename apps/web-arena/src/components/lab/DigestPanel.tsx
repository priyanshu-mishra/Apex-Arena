"use client";

import { useArena } from "../../lib/arena";
import { cn } from "../../lib/utils";
import { Badge, ConceptPill, Panel } from "../ui";
import { btn, empty, mono12 } from "../ui/kit";
import { AppTickStrip } from "./AppTickStrip";
import { CopyButton, JsonView } from "./JsonView";
import { SCALE, TICKS_PER_EPOCH, type FrozenDigest } from "./model";

export function DigestPanel({ digest, onFreeze }: { digest: FrozenDigest | null; onFreeze: () => void }) {
  const { frame } = useArena();
  const d = digest?.json;
  const pos = frame.tick % TICKS_PER_EPOCH;
  return (
    <Panel
      title="MacroDigest"
      subtitle="The exact payload a reasoning agent receives from get_market_digest"
      actions={
        <>
          {d ? <CopyButton value={d} what="MacroDigest JSON" /> : null}
          <button type="button" className={btn("ghost", "sm")} onClick={onFreeze}>
            Freeze now
          </button>
        </>
      }
      explain={{
        what: (
          <>
            A deterministic snapshot of both venues, compiled at the macro barrier. The top-level fields match the Rust <code>MacroDigest</code>{" "}
            struct that the Python MCP server returns from <code>get_market_digest</code>, with <code>state_hash</code> appended. The nested{" "}
            <code>clob</code>, <code>amm</code> and <code>basis_bps</code> blocks are workstation extensions that show the top of book and pool
            reserves the agent reasons over.
          </>
        ),
        how: (
          <>
            The digest refreshes automatically every time the arena crosses a barrier (the tick strip above fills to 100, then the market
            is held). Press Freeze now to snapshot the current tick instead, then Copy to paste it into your own agent or an LLM prompt.
          </>
        ),
        math: (
          <>
            Every price is an integer number of pips: 1.0 = 100,000,000 (SCALE = 10⁸), so <code>clob_mid_price / 10⁸</code> is the USD mid.
            No floats ever touch the kernel, which is why the same seed always yields the same <code>state_hash</code>.
          </>
        ),
      }}
    >
      <div className="flex flex-col gap-4">
        <AppTickStrip pos={pos} held={pos === 0} />
        {d && digest ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-rule pt-3">
              <Badge tone={digest.source === "barrier" ? "chaos" : undefined}>
                {digest.source === "barrier" ? "frozen at barrier" : digest.source === "manual" ? "frozen manually" : "snapshot on open"}
              </Badge>
              <span className={cn(mono12, "text-bone-2")}>
                epoch {d.epoch_index} · tick {d.tick.toLocaleString("en-US")} · mid ${(d.clob_mid_price / SCALE).toFixed(2)}
              </span>
              <span className="flex-1" />
              <ConceptPill concept="fixedPoint" label="Why integers?" align="right" />
            </div>
            <JsonView value={d} label={`MacroDigest JSON for epoch ${d.epoch_index}`} />
          </>
        ) : (
          <div className={cn(empty, "px-0")}>The first digest appears when the arena crosses its next 100-tick barrier, or press Freeze now.</div>
        )}
      </div>
    </Panel>
  );
}
