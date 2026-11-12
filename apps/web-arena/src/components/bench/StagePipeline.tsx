"use client";

import type { BenchmarkProgress, BenchmarkResult } from "../../lib/sharedBuffer";
import { displayAgentName, fmtSigned, fmtUsd } from "../../lib/arena";
import { Badge } from "../ui";
import { STAGE_META, regimeText, regimeToneOf, unit } from "./benchModel";
import { CheckIcon, StageIcon } from "./StageIcons";
import styles from "./Bench.module.css";

type Status = "pending" | "running" | "done";

function statusFor(i: number, running: boolean, progress: BenchmarkProgress | null, hasResult: boolean): Status {
  if (running && progress) {
    if (progress.progress >= 1) return "done";
    if (i < progress.stageIndex) return "done";
    if (i === progress.stageIndex) return "running";
    return "pending";
  }
  if (running) return i === 0 ? "running" : "pending";
  return hasResult ? "done" : "pending";
}

const STATUS_TEXT: Record<Status, string> = { pending: "Pending", running: "Running", done: "Done" };

export function StagePipeline({
  running,
  progress,
  result,
}: {
  running: boolean;
  progress: BenchmarkProgress | null;
  result: BenchmarkResult | null;
}) {
  const showResult = !running && result;
  const pct = running ? Math.round((progress?.progress ?? 0) * 100) : result ? 100 : 0;
  const stageCount = progress?.stageCount ?? STAGE_META.length;
  const currentIdx = progress?.stageIndex ?? 0;

  let progressLabel: string;
  if (running) {
    progressLabel = progress
      ? `Stage ${Math.min(currentIdx + 1, stageCount)} of ${stageCount}: ${STAGE_META[currentIdx]?.name ?? progress.stageName}`
      : "Starting a fresh kernel…";
  } else if (result) {
    progressLabel = `Complete: ${result.totalTicks.toLocaleString("en-US")} ticks across ${result.stages.length} stages`;
  } else {
    progressLabel = "Not started";
  }

  return (
    <div>
      <ol className={styles.pipeline} style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {STAGE_META.map((meta, i) => {
          const status = statusFor(i, running, progress, Boolean(result));
          const stage = showResult ? result.stages[i] : undefined;
          const leader = stage?.leaderboard[0];
          return (
            <li
              key={meta.key}
              className={styles.stage}
              data-status={status}
              style={{ ["--accent" as string]: `var(--${meta.tone})` }}
              aria-label={`Stage ${i + 1}, ${meta.name}: ${STATUS_TEXT[status]}`}
            >
              <div className={styles.stageTop}>
                <span className={styles.stageIcon}>
                  <StageIcon stageKey={meta.key} />
                </span>
                <span className={styles.stageIndex}>Stage {i + 1}</span>
                <span className={styles.status} data-status={status}>
                  {status === "running" ? <span className={styles.spinner} aria-hidden /> : null}
                  {status === "done" ? <CheckIcon size={12} /> : null}
                  {STATUS_TEXT[status]}
                </span>
              </div>
              <div className="stack" style={{ ["--gap" as string]: "4px" }}>
                <span className={styles.stageName}>{meta.name}</span>
                <span className={styles.stageStress}>{meta.stress}</span>
              </div>
              {stage ? (
                <div className={styles.stageStats}>
                  <div className={`${styles.stat} ${styles.statWide}`}>
                    <span className={styles.statLabel}>End regime</span>
                    <span>
                      <Badge tone={regimeToneOf(stage.regime)}>{regimeText(stage.regime)}</Badge>
                    </span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>CLOB mid</span>
                    <span className={styles.statValue}>{fmtUsd(stage.clobMidUsd)}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Revm spot</span>
                    <span className={styles.statValue}>{fmtUsd(stage.evmSpotUsd)}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Basis</span>
                    <span
                      className={styles.statValue}
                      style={{ color: Math.abs(stage.basisBps) >= 25 ? "var(--chaos)" : undefined }}
                    >
                      {fmtSigned(stage.basisBps, 1, " bps")}
                    </span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Hawkes λ</span>
                    <span className={styles.statValue}>{stage.hawkesIntensity.toFixed(3)}</span>
                  </div>
                  {leader ? (
                    <div className={`${styles.stat} ${styles.statWide}`}>
                      <span className={styles.statLabel}>Stage leader</span>
                      <span className={styles.statValue} style={{ fontFamily: "var(--font-sans)" }}>
                        {displayAgentName(leader.agentId)}{" "}
                        <span className="num text-3">ACS {unit(leader.acsScoreBps, 3)}</span>
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className={styles.progressWrap}>
        <div className="row-between" style={{ flexWrap: "wrap" }}>
          <span className="label" aria-live="polite">
            {progressLabel}
          </span>
          <span className="num caption">{pct}%</span>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-label="Benchmark progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className={styles.progressFill} style={{ width: `${pct}%`, backgroundPosition: `${pct}% 0` }} />
        </div>
      </div>
    </div>
  );
}
