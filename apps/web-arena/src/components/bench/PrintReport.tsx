"use client";

import type { BenchmarkResult } from "../../lib/sharedBuffer";
import { displayAgentName, fmtSigned, fmtUsd } from "../../lib/arena";
import {
  ACS_FORMULA,
  GRADE_SCALE,
  HASH_ALGORITHM_NOTE,
  HASH_LABEL,
  LIQUIDATION_RULE,
  STAGE_META,
  gradeFor,
  rankAgents,
  regimeText,
  unit,
} from "./benchModel";
import { cn } from "../../lib/utils";
import { btn, label } from "../ui/kit";

/* The report reads as a document: ink-2 on screen, black on white when printed. */
const H2 = "mt-6 mb-2 font-sans text-[16px] font-semibold text-bone [font-variation-settings:'wdth'_108] print:text-black";
const P = "font-sans text-[13.5px] leading-[1.55] text-bone-2 print:text-[#222]";
const RT = "w-full border-collapse font-sans text-[12.5px] tabular-nums [&_td]:border-b [&_td]:border-rule [&_td]:px-2 [&_td]:py-1.5 [&_th]:border-b [&_th]:border-rule-2 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-normal [&_th]:text-bone-2 [&_.r]:text-right print:[&_td]:border-[#ccc] print:[&_th]:border-[#999] print:[&_th]:text-black print:[&_tr]:break-inside-avoid";

export function PrintReport({
  result,
  generatedAt,
  onPrint,
  onClose,
}: {
  result: BenchmarkResult;
  generatedAt: Date;
  onPrint: () => void;
  onClose: () => void;
}) {
  const agents = rankAgents(result.agents);
  return (
    <section
      className="rounded-[2px] border border-rule bg-ink-2 print:border-0 print:bg-white"
      aria-label="Printable benchmark report"
      data-print-report
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3 print:hidden">
        <span className={label}>Print preview. Only the report below is sent to the printer.</span>
        <span className="flex gap-2">
          <button type="button" className={btn("ghost", "sm")} onClick={onClose}>
            Close preview
          </button>
          <button type="button" className={btn("primary", "sm")} onClick={onPrint}>
            Print or save as PDF
          </button>
        </span>
      </div>
      <article className="p-6 text-bone print:p-0 print:text-black">
        <h1 className="font-sans text-[26px] leading-[1.1] font-[560] tracking-[-0.02em] [font-variation-settings:'wdth'_118]">
          ApexArena chaos benchmark report
        </h1>
        <p className={cn(P, "mt-2")}>
          Standardized four-stage stress suite run on a fresh deterministic kernel. Every agent faced the same order
          flow, the same shocks and the same random draws.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 font-sans text-[13px] sm:grid-cols-2 [&_dd]:font-mono [&_dd]:text-[12.5px] [&_dd]:break-all [&_dt]:text-bone-3 print:[&_dt]:text-[#555]">
          <div>
            <dt>Seed</dt>
            <dd>{result.seed}</dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>{generatedAt.toISOString()}</dd>
          </div>
          <div>
            <dt>Ticks</dt>
            <dd>
              {result.ticksPerStage} per stage · {result.totalTicks} total (10 ms each)
            </dd>
          </div>
          <div>
            <dt>Agents scored</dt>
            <dd>{result.agents.length}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt>Final {HASH_LABEL}</dt>
            <dd>{result.stateHash}</dd>
          </div>
        </dl>

        <h2 className={H2}>Scoring formula</h2>
        <p className="font-mono text-[12.5px] text-bone print:text-black">{ACS_FORMULA}</p>
        <p className={P}>{LIQUIDATION_RULE}</p>
        <p className={P}>
          Grades: {GRADE_SCALE.map((g) => `${g.grade} (${g.meaning})`).join(", ")}.
        </p>

        <h2 className={H2}>Stage summary</h2>
        <div className="max-w-full overflow-x-auto print:overflow-visible">
          <table className={cn(RT, "min-w-[720px] print:min-w-0")}>
            <thead>
              <tr>
                <th>Stage</th>
                <th>End regime</th>
                <th className="r">End tick</th>
                <th className="r">CLOB mid</th>
                <th className="r">Revm spot</th>
                <th className="r">Basis</th>
                <th className="r">Hawkes λ</th>
                <th>Leader</th>
              </tr>
            </thead>
            <tbody>
              {result.stages.map((s, i) => {
                const leader = s.leaderboard[0];
                return (
                  <tr key={s.key}>
                    <td>
                      {i + 1}. {STAGE_META[i]?.name ?? s.name}
                    </td>
                    <td>{regimeText(s.regime)}</td>
                    <td className="r">{s.endTick}</td>
                    <td className="r">{fmtUsd(s.clobMidUsd)}</td>
                    <td className="r">{fmtUsd(s.evmSpotUsd)}</td>
                    <td className="r">{fmtSigned(s.basisBps, 1, " bps")}</td>
                    <td className="r">{s.hawkesIntensity.toFixed(3)}</td>
                    <td>{leader ? `${displayAgentName(leader.agentId)} (${unit(leader.acsScoreBps, 3)})` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h2 className={H2}>Scorecard</h2>
        <div className="max-w-full overflow-x-auto print:overflow-visible">
          <table className={cn(RT, "min-w-[720px] print:min-w-0")}>
            <thead>
              <tr>
                <th className="r">Rank</th>
                <th>Agent</th>
                <th>Grade</th>
                <th className="r">ACS</th>
                <th className="r">PSR(0)</th>
                <th className="r">Calmar</th>
                <th className="r">Max DD</th>
                <th className="r">OOD survival</th>
                <th className="r">Win rate</th>
                <th className="r">Final equity</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a, i) => (
                <tr key={a.agentId}>
                  <td className="r">{i + 1}</td>
                  <td>{displayAgentName(a.agentId)}</td>
                  <td className="font-mono">{gradeFor(a).label}</td>
                  <td className="r">{unit(a.acsScoreBps, 3)}</td>
                  <td className="r">{unit(a.psrBps)}</td>
                  <td className="r">{unit(a.calmarBps)}</td>
                  <td className="r">{a.maxDrawdownPct.toFixed(2)}%</td>
                  <td className="r">{unit(a.oodSurvivalBps)}</td>
                  <td className="r">{a.winRatePct.toFixed(1)}%</td>
                  <td className="r">{fmtUsd(a.equityUsd, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className={cn(P, "mt-6 text-[12.5px]")}>
          State digest: {HASH_ALGORITHM_NOTE} Re-running with seed {result.seed}, {result.ticksPerStage} ticks per stage
          and the same deployed agents reproduces this digest exactly.
        </p>
      </article>
    </section>
  );
}
