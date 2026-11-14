"use client";

import React, { useMemo, useState } from "react";
import type { BenchmarkAgentResult, BenchmarkResult } from "../../lib/sharedBuffer";
import { agentKind, displayAgentName, fmtUsd } from "../../lib/arena";
import type { ConceptKey } from "../../lib/concepts";
import { cn } from "../../lib/utils";
import { ConceptPill } from "../ui";
import { mono12, num, table, tableScroll, td, tdNum, th } from "../ui/kit";
import { GRADE_SCALE, STAGE_META, gradeFor, unit, type GradeInfo } from "./benchModel";
import { Sparkline } from "./Sparkline";

/** A grade as mono text; liquidated grades read in vermilion (the word carries it too). */
export function GradeChip({ info }: { info: GradeInfo }) {
  return (
    <span
      className={cn(mono12, "text-[13px] whitespace-nowrap", info.liquidated ? "text-ask" : "text-bone")}
      aria-label={info.liquidated ? "Grade F, liquidated" : `Grade ${info.grade}`}
    >
      {info.label}
    </span>
  );
}

export function GradeLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-sans text-[12.5px] text-bone-2" aria-label="Grade scale">
      {GRADE_SCALE.map((g) => (
        <span key={g.grade} className="inline-flex items-baseline gap-2">
          <b className={cn(num, "text-[13px] font-medium text-bone")}>{g.grade}</b>
          {g.meaning}
        </span>
      ))}
    </div>
  );
}

type SortKey = "agent" | "grade" | "acs" | "psr" | "calmar" | "mdd" | "ood" | "win" | "equity";

interface Col {
  key: SortKey;
  label: string;
  concept?: ConceptKey;
  right?: boolean;
  /** Lower is better (drawdown). Default sort direction flips. */
  lowerBetter?: boolean;
  value: (a: BenchmarkAgentResult) => number | string;
}

const COLS: Col[] = [
  { key: "agent", label: "Agent", value: (a) => displayAgentName(a.agentId).toLowerCase() },
  { key: "grade", label: "Grade", value: (a) => gradeFor(a).rank * 100000 + a.acsScoreBps },
  { key: "acs", label: "ACS", concept: "acs", right: true, value: (a) => a.acsScoreBps },
  { key: "psr", label: "PSR(0)", concept: "psr", right: true, value: (a) => a.psrBps },
  { key: "calmar", label: "Calmar", concept: "calmar", right: true, value: (a) => a.calmarBps },
  { key: "mdd", label: "Max drawdown", right: true, lowerBetter: true, value: (a) => a.maxDrawdownPct },
  { key: "ood", label: "OOD survival", concept: "ood", right: true, value: (a) => a.oodSurvivalBps },
  { key: "win", label: "Win rate", right: true, value: (a) => a.winRatePct },
  { key: "equity", label: "Final equity", right: true, value: (a) => a.equityUsd },
];

export function Scorecard({ result }: { result: BenchmarkResult }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "grade", dir: "desc" });

  const rows = useMemo(() => {
    const col = COLS.find((c) => c.key === sort.key) ?? COLS[1];
    const sign = sort.dir === "asc" ? 1 : -1;
    return result.agents.slice().sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : va - (vb as number);
      return cmp * sign || b.acsScoreBps - a.acsScoreBps;
    });
  }, [result.agents, sort]);

  const onSort = (c: Col) => {
    setSort((s) =>
      s.key === c.key
        ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: c.key, dir: c.key === "agent" || c.lowerBetter ? "asc" : "desc" },
    );
  };

  return (
    <div className={tableScroll}>
      <table className={cn(table, "min-w-[960px]")}>
        <caption className="sr-only">
          Institutional scorecard for seed {result.seed}. Click a column header to sort.
        </caption>
        <thead>
          <tr>
            {COLS.map((c) => {
              const active = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  className={cn(th, c.right && "text-right")}
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  scope="col"
                >
                  <span className={cn("inline-flex items-center gap-1.5", c.right && "justify-end")}>
                    <button
                      type="button"
                      className={cn("inline-flex items-center gap-1 font-sans text-[12px] hover:text-bone", active ? "text-bone" : "text-bone-2")}
                      data-active={active}
                      onClick={() => onSort(c)}
                      aria-label={`Sort by ${c.label}`}
                    >
                      {c.label}
                      <span className="inline-block w-2.5 font-mono" aria-hidden>
                        {active ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                      </span>
                    </button>
                    {c.concept ? <ConceptPill concept={c.concept} label="?" align={c.right ? "right" : "left"} /> : null}
                  </span>
                </th>
              );
            })}
            <th scope="col" className={th}>
              Equity curve
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const g = gradeFor(a);
            const kind = agentKind(a.badge);
            return (
              <tr key={a.agentId} data-liquidated={g.liquidated || undefined}>
                <td className={td}>
                  <span className="flex flex-col gap-1">
                    <span className={cn("font-sans text-[14px] font-[560] text-bone [font-variation-settings:'wdth'_110]", g.liquidated && "text-bone-3 line-through decoration-1")}>
                      {displayAgentName(a.agentId)}
                    </span>
                    <span className="font-sans text-[12px] text-bone-3">{kind.label}</span>
                  </span>
                </td>
                <td className={td}>
                  <GradeChip info={g} />
                </td>
                <td className={cn(tdNum, "text-[15px]", g.liquidated && "text-ask")}>{unit(a.acsScoreBps, 3)}</td>
                <td className={tdNum}>{unit(a.psrBps)}</td>
                <td className={tdNum}>{unit(a.calmarBps)}</td>
                <td className={tdNum} style={{ color: a.maxDrawdownPct >= 5 ? "var(--ask)" : undefined }}>
                  {a.maxDrawdownPct.toFixed(2)}%
                </td>
                <td className={tdNum}>{unit(a.oodSurvivalBps)}</td>
                <td className={tdNum}>{a.winRatePct.toFixed(1)}%</td>
                <td className={tdNum}>{fmtUsd(a.equityUsd, 0)}</td>
                <td className={td}>
                  <Sparkline values={a.equityCurve} label={displayAgentName(a.agentId)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Agent × stage ACS heatmap: ACS read from each stage's closing leaderboard. */
export function StageMatrix({ result }: { result: BenchmarkResult }) {
  const agents = useMemo(
    () => result.agents.slice().sort((a, b) => gradeFor(b).rank - gradeFor(a).rank || b.acsScoreBps - a.acsScoreBps),
    [result.agents],
  );
  return (
    <div className={tableScroll}>
      <table className={cn(table, "min-w-[720px]")}>
        <caption className="sr-only">ACS at the end of each stage, per agent</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              Agent
            </th>
            {result.stages.map((s, i) => (
              <th key={s.key} scope="col" className={cn(th, "text-right")}>
                {i + 1}. {STAGE_META[i]?.name ?? s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.agentId}>
              <td className={cn(td, "font-sans text-[14px] text-bone")}>{displayAgentName(a.agentId)}</td>
              {result.stages.map((s) => {
                const e = s.leaderboard.find((x) => x.agentId === a.agentId);
                if (!e) {
                  return (
                    <td key={s.key} className={cn(tdNum, "text-bone-3")}>
                      n/a
                    </td>
                  );
                }
                const liq = e.status === "LIQ";
                const v = e.acsScoreBps / 10000;
                // Mint at up to 18% alpha (the order book's depth-bar strength) scaled by ACS above the 0.35 floor; amber below it.
                const bg = liq
                  ? "color-mix(in srgb, var(--ask) 18%, transparent)"
                  : v >= 0.35
                    ? `color-mix(in srgb, var(--bid) ${Math.round(4 + ((v - 0.35) / 0.65) * 14)}%, transparent)`
                    : `color-mix(in srgb, var(--shock) ${Math.round(6 + (v / 0.35) * 8)}%, transparent)`;
                return (
                  <td key={s.key} className={cn(tdNum, "p-1 first:pl-1 last:pr-0")}>
                    <span
                      className="block px-2 py-1.5 text-right"
                      style={{ background: bg, color: liq ? "var(--ask)" : undefined }}
                      title={`${displayAgentName(a.agentId)} after ${s.name}: ACS ${v.toFixed(3)}${liq ? " (liquidated)" : ""}`}
                    >
                      {liq ? "Liq. 0.000" : v.toFixed(3)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
