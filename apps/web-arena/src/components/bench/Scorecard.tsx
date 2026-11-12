"use client";

import React, { useMemo, useState } from "react";
import type { BenchmarkAgentResult, BenchmarkResult } from "../../lib/sharedBuffer";
import { agentKind, displayAgentName, fmtUsd } from "../../lib/arena";
import type { ConceptKey } from "../../lib/concepts";
import { Badge, ConceptPill } from "../ui";
import { GRADE_SCALE, STAGE_META, gradeFor, unit, type GradeInfo } from "./benchModel";
import { Sparkline } from "./Sparkline";
import styles from "./Bench.module.css";

export function GradeChip({ info }: { info: GradeInfo }) {
  return (
    <span
      className={`${styles.grade} ${info.liquidated ? styles.gradeLiq : ""}`}
      style={{ ["--accent" as string]: `var(--${info.tone})` }}
      aria-label={info.liquidated ? "Grade F, liquidated" : `Grade ${info.grade}`}
    >
      {info.label}
    </span>
  );
}

export function GradeLegend() {
  return (
    <div className={styles.gradeLegend} aria-label="Grade scale">
      {GRADE_SCALE.map((g) => (
        <span key={g.grade}>
          <span className={styles.grade} style={{ ["--accent" as string]: `var(--${g.tone})` }}>
            {g.grade}
          </span>
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
    <div className={styles.tableScroll}>
      <table className="table">
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
                  className={c.right ? "r" : undefined}
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  scope="col"
                >
                  <span className={`${styles.thInner} ${c.right ? styles.thRight : ""}`}>
                    <button
                      type="button"
                      className={styles.sortBtn}
                      data-active={active}
                      onClick={() => onSort(c)}
                      aria-label={`Sort by ${c.label}`}
                    >
                      {c.label}
                      <span className={styles.sortArrow} aria-hidden>
                        {active ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                      </span>
                    </button>
                    {c.concept ? <ConceptPill concept={c.concept} label="?" align={c.right ? "right" : "left"} /> : null}
                  </span>
                </th>
              );
            })}
            <th scope="col">Equity curve</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const g = gradeFor(a);
            const kind = agentKind(a.badge);
            return (
              <tr key={a.agentId} className={g.liquidated ? styles.rowLiq : undefined}>
                <td>
                  <span className={styles.agentCell}>
                    <span className={styles.agentName}>{displayAgentName(a.agentId)}</span>
                    <Badge tone={kind.tone}>{kind.label}</Badge>
                  </span>
                </td>
                <td>
                  <GradeChip info={g} />
                </td>
                <td className="r num" style={{ color: "var(--text)", fontWeight: 650 }}>
                  {unit(a.acsScoreBps, 3)}
                </td>
                <td className="r num">{unit(a.psrBps)}</td>
                <td className="r num">{unit(a.calmarBps)}</td>
                <td className="r num" style={{ color: a.maxDrawdownPct >= 5 ? "var(--ask)" : undefined }}>
                  {a.maxDrawdownPct.toFixed(2)}%
                </td>
                <td className="r num">{unit(a.oodSurvivalBps)}</td>
                <td className="r num">{a.winRatePct.toFixed(1)}%</td>
                <td className="r num" style={{ color: "var(--text)" }}>
                  {fmtUsd(a.equityUsd, 0)}
                </td>
                <td>
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
    <div className={`${styles.tableScroll} ${styles.matrixScroll}`}>
      <table className={`table ${styles.matrix}`}>
        <caption className="sr-only">ACS at the end of each stage, per agent</caption>
        <thead>
          <tr>
            <th scope="col">Agent</th>
            {result.stages.map((s, i) => (
              <th key={s.key} scope="col">
                {i + 1}. {STAGE_META[i]?.name ?? s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.agentId}>
              <td>
                <span className={styles.agentName}>{displayAgentName(a.agentId)}</span>
              </td>
              {result.stages.map((s) => {
                const e = s.leaderboard.find((x) => x.agentId === a.agentId);
                if (!e) {
                  return (
                    <td key={s.key} className={styles.heatCell}>
                      <span className={styles.heatInner} style={{ color: "var(--text-4)" }}>
                        n/a
                      </span>
                    </td>
                  );
                }
                const liq = e.status === "LIQ";
                const v = e.acsScoreBps / 10000;
                // Opacity scales from 0.35 (ACS floor) to 0.9; below the floor tints toward rose.
                const bg = liq
                  ? "var(--ask-soft)"
                  : v >= 0.35
                    ? `color-mix(in srgb, var(--bid) ${Math.round(8 + ((v - 0.35) / 0.65) * 42)}%, transparent)`
                    : `color-mix(in srgb, var(--chaos) ${Math.round(10 + (v / 0.35) * 10)}%, transparent)`;
                return (
                  <td key={s.key} className={styles.heatCell}>
                    <span
                      className={styles.heatInner}
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
