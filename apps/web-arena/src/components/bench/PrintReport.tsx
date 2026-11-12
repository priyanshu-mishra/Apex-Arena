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
import styles from "./Bench.module.css";

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
    <section className={styles.reportPreview} aria-label="Printable benchmark report">
      <div className={styles.reportToolbar}>
        <span className="label">Print preview. Only the report below is sent to the printer.</span>
        <span className="row" style={{ ["--gap" as string]: "8px" }}>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close preview
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onPrint}>
            Print or save as PDF
          </button>
        </span>
      </div>
      <article className={styles.report}>
        <h1>ApexArena chaos benchmark report</h1>
        <p>
          Standardized four-stage stress suite run on a fresh deterministic kernel. Every agent faced the same order
          flow, the same shocks and the same random draws.
        </p>
        <dl className={styles.reportMeta}>
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
          <div style={{ gridColumn: "1 / -1" }}>
            <dt>Final {HASH_LABEL}</dt>
            <dd>{result.stateHash}</dd>
          </div>
        </dl>

        <h2>Scoring formula</h2>
        <p className={styles.reportFormula}>{ACS_FORMULA}</p>
        <p>{LIQUIDATION_RULE}</p>
        <p>
          Grades: {GRADE_SCALE.map((g) => `${g.grade} (${g.meaning})`).join(", ")}.
        </p>

        <h2>Stage summary</h2>
        <div className={styles.reportTableWrap}>
          <table className={styles.reportTable}>
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

        <h2>Scorecard</h2>
        <div className={styles.reportTableWrap}>
          <table className={styles.reportTable}>
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
                  <td className={styles.reportGrade}>{gradeFor(a).label}</td>
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

        <p className={styles.reportFoot}>
          State digest: {HASH_ALGORITHM_NOTE} Re-running with seed {result.seed}, {result.ticksPerStage} ticks per stage
          and the same deployed agents reproduces this digest exactly.
        </p>
      </article>
    </section>
  );
}
