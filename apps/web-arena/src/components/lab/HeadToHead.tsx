"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { agentKind, displayAgentName, fmtSigned, fmtUsd, useArena } from "../../lib/arena";
import type { LeaderboardEntryUi, PricePointUi } from "../../lib/sharedBuffer";
import type { ConceptKey } from "../../lib/concepts";
import { cn } from "../../lib/utils";
import { Badge, ConceptPill, Panel } from "../ui";
import { empty, field, fieldLabel, label, mono12, select, table, tableScroll, td, tdNum, th } from "../ui/kit";
import { equitySeries } from "./model";

const SWATCH = "mr-2 inline-block h-[2px] w-3 align-middle";

type Better = "high" | "low" | "none";
interface Row {
  label: string;
  concept?: ConceptKey;
  better: Better;
  get: (e: LeaderboardEntryUi) => number;
  fmt: (v: number) => string;
}

const unit = (bps: number) => (bps / 10000).toFixed(3);

const ROWS: Row[] = [
  { label: "Apex Composite Score", concept: "acs", better: "high", get: (e) => e.acsScoreBps, fmt: unit },
  { label: "PSR(0)", concept: "psr", better: "high", get: (e) => e.psrBps, fmt: unit },
  { label: "Calmar (capped)", concept: "calmar", better: "high", get: (e) => e.calmarBps, fmt: unit },
  { label: "OOD survival", concept: "ood", better: "high", get: (e) => e.oodSurvivalBps, fmt: unit },
  { label: "Equity", better: "high", get: (e) => e.equityUsd, fmt: (v) => fmtUsd(v, 0) },
  { label: "PnL", better: "high", get: (e) => e.pnlBps, fmt: (v) => fmtSigned(v, 0, " bps") },
  { label: "Max drawdown", better: "low", get: (e) => e.maxDrawdownBps, fmt: (v) => `${v.toLocaleString("en-US")} bps` },
  { label: "Fills", better: "none", get: (e) => e.totalFills, fmt: (v) => v.toLocaleString("en-US") },
  { label: "Quoted spread", concept: "spread", better: "none", get: (e) => e.activeSpreadBps, fmt: (v) => `${v} bps` },
];

const COLOR_A = "var(--pool)";
const COLOR_B = "var(--bone)";

function Sparkline({ history, a, b }: { history: PricePointUi[]; a: string; b: string }) {
  const { pathA, pathB, min, max, empty: isEmpty } = useMemo(() => {
    const sa = equitySeries(history, a);
    const sb = equitySeries(history, b);
    const all = [...sa, ...sb];
    if (all.length < 2) return { pathA: "", pathB: "", min: 0, max: 0, empty: true };
    let t0 = Infinity,
      t1 = -Infinity,
      lo = Infinity,
      hi = -Infinity;
    for (const p of all) {
      t0 = Math.min(t0, p.t);
      t1 = Math.max(t1, p.t);
      lo = Math.min(lo, p.v);
      hi = Math.max(hi, p.v);
    }
    if (hi - lo < 1) {
      hi += 1;
      lo -= 1;
    }
    const W = 600,
      H = 120,
      P = 6;
    const toPath = (s: { t: number; v: number }[]) => {
      if (s.length === 0) return "";
      const stride = Math.max(1, Math.floor(s.length / 300));
      let d = "";
      for (let i = 0; i < s.length; i += stride) {
        const p = s[i];
        const x = t1 > t0 ? ((p.t - t0) / (t1 - t0)) * W : W;
        const y = P + (1 - (p.v - lo) / (hi - lo)) * (H - 2 * P);
        d += `${d ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      }
      const lastP = s[s.length - 1];
      const lx = t1 > t0 ? ((lastP.t - t0) / (t1 - t0)) * W : W;
      const ly = P + (1 - (lastP.v - lo) / (hi - lo)) * (H - 2 * P);
      return d + `L${lx.toFixed(1)},${ly.toFixed(1)}`;
    };
    return { pathA: toPath(sa), pathB: toPath(sb), min: lo, max: hi, empty: false };
  }, [history, a, b]);

  if (isEmpty) return <div className={cn(empty, "px-0")}>Equity history builds up as the arena runs.</div>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={label}>Equity over the last {history.length.toLocaleString("en-US")} samples</span>
        <span className={cn(mono12, "text-bone-3")}>
          {fmtUsd(min, 0)} – {fmtUsd(max, 0)}
        </span>
      </div>
      <svg
        className="block h-[120px] w-full border-y border-rule"
        viewBox="0 0 600 120"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Equity curves for ${displayAgentName(a)} and ${displayAgentName(b)}`}
      >
        <path d={pathA} fill="none" stroke={COLOR_A} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        <path d={pathB} fill="none" stroke={COLOR_B} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-[12.5px] text-bone-2">
        <span>
          <span className={SWATCH} style={{ background: COLOR_A }} />
          {displayAgentName(a)}
        </span>
        <span>
          <span className={SWATCH} style={{ background: COLOR_B }} />
          {displayAgentName(b)}
        </span>
      </div>
    </div>
  );
}

function AgentSelect({
  label,
  value,
  onChange,
  board,
  color,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  board: LeaderboardEntryUi[];
  color: string;
}) {
  const id = useId();
  return (
    <div className={field}>
      <label className={fieldLabel} htmlFor={id}>
        <span>
          <span className={SWATCH} style={{ background: color }} />
          {label}
        </span>
      </label>
      <select id={id} className={select} value={value} onChange={(e) => onChange(e.target.value)}>
        {board.map((e) => (
          <option key={e.agentId} value={e.agentId}>
            {displayAgentName(e.agentId)} ({agentKind(e.badge).label}){e.status === "LIQ" ? " · liquidated" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

export function HeadToHead() {
  const { frame, history } = useArena();
  const board = frame.leaderboard;
  const [a, setA] = useState("Gemini-2.5");
  const [b, setB] = useState("DeepSeek-R1");

  // Keep selections valid if the leaderboard changes shape.
  useEffect(() => {
    if (board.length === 0) return;
    const ids = board.map((e) => e.agentId);
    if (!ids.includes(a)) setA(ids[0]);
    if (!ids.includes(b)) setB(ids.find((x) => x !== (ids.includes(a) ? a : ids[0])) ?? ids[0]);
  }, [board, a, b]);

  const ea = board.find((e) => e.agentId === a);
  const eb = board.find((e) => e.agentId === b);

  return (
    <Panel
      title="Head-to-head"
      subtitle="Compare any two agents on the metrics that make up the benchmark"
      explain={{
        what: (
          <>
            Side-by-side scorecard for two agents in the live arena. A mint mark sits beside the better value on each row. Fills and quoted
            spread describe trading style rather than quality, so they have no winner.
          </>
        ),
        how: <>Pick two agents. Deploy a custom agent above and compare it against the LLMs within a few epochs.</>,
        math: (
          <>
            ACS = 0.40·PSR(0) + 0.30·Calmar + 0.20·Survival_OOD − 0.10·Penalty_turnover, each on a 0 to 1 scale. A liquidated agent scores
            0 regardless of its other metrics.
          </>
        ),
      }}
    >
      {board.length < 2 ? (
        <div className={cn(empty, "px-0")}>At least two agents are needed. The leaderboard fills in as the arena starts.</div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
            <AgentSelect label="Agent A" value={a} onChange={setA} board={board} color={COLOR_A} />
            <span className="pb-2 font-sans text-[13px] text-bone-3" aria-hidden>
              vs
            </span>
            <AgentSelect label="Agent B" value={b} onChange={setB} board={board} color={COLOR_B} />
          </div>

          {ea && eb ? (
            <div className={cn(tableScroll, "-mx-4")}>
              <table className={cn(table, "min-w-[420px]")}>
                <caption className="sr-only">
                  Metrics for {displayAgentName(a)} and {displayAgentName(b)}; the better value per row is marked.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className={th}>Metric</th>
                    <th scope="col" className={cn(th, "text-right")}>
                      {displayAgentName(a)} {ea.status === "LIQ" ? <Badge tone="ask">liquidated</Badge> : null}
                    </th>
                    <th scope="col" className={cn(th, "text-right")}>
                      {displayAgentName(b)} {eb.status === "LIQ" ? <Badge tone="ask">liquidated</Badge> : null}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => {
                    const va = r.get(ea);
                    const vb = r.get(eb);
                    const aWins = r.better === "high" ? va > vb : r.better === "low" ? va < vb : false;
                    const bWins = r.better === "high" ? vb > va : r.better === "low" ? vb < va : false;
                    return (
                      <tr key={r.label}>
                        <th scope="row" className={cn(td, "font-normal text-left")}>
                          <span className="inline-flex items-center gap-2">
                            {r.label}
                            {r.concept ? <ConceptPill concept={r.concept} label="?" /> : null}
                          </span>
                        </th>
                        <td className={cn(tdNum, !aWins && "text-bone-2")}>
                          {aWins ? <><span className="mr-2 inline-block size-[7px] rounded-[1px] bg-bid align-middle" aria-hidden /><span className="sr-only">Better: </span></> : null}
                          {r.fmt(va)}
                        </td>
                        <td className={cn(tdNum, !bWins && "text-bone-2")}>
                          {bWins ? <><span className="mr-2 inline-block size-[7px] rounded-[1px] bg-bid align-middle" aria-hidden /><span className="sr-only">Better: </span></> : null}
                          {r.fmt(vb)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <div>
            <Sparkline history={history} a={a} b={b} />
          </div>
        </div>
      )}
    </Panel>
  );
}
