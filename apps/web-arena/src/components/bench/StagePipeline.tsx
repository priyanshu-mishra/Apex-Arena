"use client";

import type { BenchmarkProgress, BenchmarkResult } from "../../lib/sharedBuffer";
import { displayAgentName, fmtSigned, fmtUsd } from "../../lib/arena";
import { useDensity } from "../../lib/density";
import { cn } from "../../lib/utils";
import { dot, label, mono12, toneColor } from "../ui/kit";
import { STAGE_META, regimeText, unit } from "./benchModel";

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

const STATUS_TEXT: Record<Status, string> = { pending: "pending", running: "running", done: "done" };

function Stat({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className={cn(label, "text-[12px]")}>{k}</span>
      <span className={cn(mono12, "text-[13px] text-bone")} style={color ? { color } : undefined}>
        {v}
      </span>
    </span>
  );
}

/**
 * The four stages as landing stack rows: big word / mono status / one
 * sentence. Done stages add where the market ended (Pro: every readout).
 */
export function StagePipeline({
  running,
  progress,
  result,
}: {
  running: boolean;
  progress: BenchmarkProgress | null;
  result: BenchmarkResult | null;
}) {
  const [density] = useDensity();
  const pro = density === "pro";
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
    <div className="flex flex-col">
      <ol className="m-0 list-none border-t border-rule-2 p-0">
        {STAGE_META.map((meta, i) => {
          const status = statusFor(i, running, progress, Boolean(result));
          const stage = showResult ? result.stages[i] : undefined;
          const leader = stage?.leaderboard[0];
          return (
            <li
              key={meta.key}
              data-status={status}
              aria-label={`Stage ${i + 1}, ${meta.name}: ${STATUS_TEXT[status]}`}
              className={cn(
                "grid grid-cols-1 items-baseline gap-x-6 gap-y-2 border-b border-rule py-5 transition-opacity duration-300 md:grid-cols-12",
                status === "pending" && running ? "opacity-40" : "opacity-100",
              )}
            >
              <span className="font-sans text-[length:clamp(22px,2.4vw,34px)] leading-none font-[560] tracking-[-0.03em] text-bone [font-variation-settings:'wdth'_122] md:col-span-5">
                {meta.name}
              </span>
              <span className={cn(mono12, "flex items-center gap-2 text-bone-2 md:col-span-2")}>
                <span
                  className={dot}
                  style={{
                    background: status === "running" ? "var(--shock)" : status === "done" ? toneColor(meta.tone) : "transparent",
                    outline: status === "pending" ? "1px solid var(--bone-3)" : undefined,
                  }}
                  aria-hidden
                />
                {String(i + 1).padStart(2, "0")} · {STATUS_TEXT[status]}
                {status === "running" ? ` ${pct}%` : ""}
              </span>
              <div className="flex min-w-0 flex-col gap-3 md:col-span-5">
                <p className="font-sans text-[length:clamp(14px,1.1vw,16px)] leading-[1.45] text-bone-2 text-pretty">{meta.stress}</p>
                {stage ? (
                  pro ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                      <Stat k="End regime" v={regimeText(stage.regime)} />
                      <Stat k="CLOB mid" v={fmtUsd(stage.clobMidUsd)} />
                      <Stat k="Revm spot" v={fmtUsd(stage.evmSpotUsd)} />
                      <Stat k="Basis" v={fmtSigned(stage.basisBps, 1, " bps")} color={Math.abs(stage.basisBps) >= 25 ? "var(--shock)" : undefined} />
                      <Stat k="Hawkes λ" v={stage.hawkesIntensity.toFixed(3)} />
                      {leader ? <Stat k="Stage leader" v={`${displayAgentName(leader.agentId)} ${unit(leader.acsScoreBps, 3)}`} /> : null}
                    </div>
                  ) : (
                    <p className={cn(mono12, "text-bone-3")}>
                      ended {regimeText(stage.regime).toLowerCase()}
                      {leader ? ` · led by ${displayAgentName(leader.agentId)} at ${unit(leader.acsScoreBps, 3)}` : ""}
                    </p>
                  )
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className={label} aria-live="polite">
            {progressLabel}
          </span>
          <span className={cn(mono12, "text-bone-2")}>{pct}%</span>
        </div>
        <div
          className="relative h-px w-full bg-rule-2"
          role="progressbar"
          aria-label="Benchmark progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="absolute -top-px left-0 h-[3px] bg-bone transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
