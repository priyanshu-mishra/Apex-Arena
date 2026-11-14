"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { agentKind, displayAgentName, fmtUsd, useArena } from "../../lib/arena";
import { Pro, useDensity } from "../../lib/density";
import type { BenchmarkResult, LeaderboardEntryUi } from "../../lib/sharedBuffer";
import { cn } from "../../lib/utils";
import { ConceptPill, KpiCard, Panel, Segmented } from "../ui";
import { btn, caption, empty, field, fieldLabel, input, num, page, table, tableScroll, td, tdNum, th } from "../ui/kit";
import { Leaderboard } from "../landing/Leaderboard";
import { WeightBar } from "../landing/WeightBar";
import {
  ACS_FORMULA,
  HASH_LABEL,
  STAGE_META,
  downloadJson,
  gradeFor,
  rankAgents,
  shortHash,
  unit,
} from "../bench/benchModel";
import { StagePipeline } from "../bench/StagePipeline";
import { GradeChip, GradeLegend, Scorecard, StageMatrix } from "../bench/Scorecard";
import { PrintReport } from "../bench/PrintReport";
import { PageHead } from "./PageHead";

type TicksOption = 100 | 200 | 400;

interface RunRecord {
  seed: number;
  ticksPerStage: number;
  agentsKey: string;
  hash: string;
}

const agentsKeyOf = (r: BenchmarkResult) =>
  r.agents
    .map((a) => a.agentId)
    .sort()
    .join("|");

export function BenchmarkView() {
  const { benchmark, actions, frame } = useArena();
  const { running, progress, result } = benchmark;

  const [seedText, setSeedText] = useState("42");
  const [ticks, setTicks] = useState<TicksOption>(200);
  const [showReport, setShowReport] = useState(false);
  const [printRequested, setPrintRequested] = useState(false);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [generatedAt, setGeneratedAt] = useState<Date>(() => new Date());
  const lastResult = useRef<BenchmarkResult | null>(result);

  const seed = Number(seedText);
  const seedValid = seedText.trim() !== "" && Number.isInteger(seed) && seed >= 0 && seed <= 4294967295;

  // Record each completed run so a repeated seed can be checked against the previous digest.
  useEffect(() => {
    if (!result || result === lastResult.current) return;
    lastResult.current = result;
    setGeneratedAt(new Date());
    setShowReport(false);
    setRuns((prev) => [
      ...prev,
      { seed: result.seed, ticksPerStage: result.ticksPerStage, agentsKey: agentsKeyOf(result), hash: result.stateHash },
    ]);
  }, [result]);

  useEffect(() => {
    if (!printRequested || !showReport) return;
    const id = window.setTimeout(() => {
      window.print();
      setPrintRequested(false);
    }, 60);
    return () => window.clearTimeout(id);
  }, [printRequested, showReport]);

  const start = () => {
    if (!seedValid || running) return;
    setShowReport(false);
    actions.runBenchmark(ticks, seed);
  };

  const replication = useMemo(() => {
    if (!result || runs.length < 2) return null;
    const key = agentsKeyOf(result);
    const prior = runs
      .slice(0, -1)
      .filter((r) => r.seed === result.seed && r.ticksPerStage === result.ticksPerStage && r.agentsKey === key);
    if (!prior.length) return null;
    const match = prior.every((r) => r.hash === result.stateHash);
    return { match, count: prior.length + 1 };
  }, [result, runs]);

  const showResult = Boolean(result) && !running;
  const [density] = useDensity();
  const pro = density === "pro";

  /* The scorecard is the landing leaderboard: name + role, profit, worst drop, Apex score (Pro adds the parts). */
  const boardRows = useMemo(
    () =>
      result
        ? rankAgents(result.agents).map((a) => {
            const g = gradeFor(a);
            return {
              agentId: displayAgentName(a.agentId),
              role: g.liquidated ? "F / Liquidated" : `grade ${g.grade} · ${agentKind(a.badge).label.toLowerCase()}`,
              pnlBps: a.pnlBps,
              maxDrawdownBps: Math.round(a.maxDrawdownPct * 100),
              psr: a.psrBps / 10000,
              calmar: a.calmarBps / 10000,
              survival: a.oodSurvivalBps / 10000,
              acs: a.status === "LIQ" ? 0 : a.acsScoreBps / 10000,
              liquidated: g.liquidated,
            };
          })
        : [],
    [result],
  );

  return (
    <div className={cn(page, "print:[&:has([data-print-report])>:not([data-print-report])]:hidden")}>
      <PageHead
        title="Benchmark"
        lede="One standardized test every agent takes under identical conditions: a fresh deterministic kernel runs four stress stages back to back, then grades each agent on the Apex score. The live arena keeps running while it works."
      >
        <Pro>
          <ul className="flex max-w-[52em] list-none flex-col gap-1.5 font-sans text-[13.5px] leading-[1.5] text-bone-2">
            <li>
              Robustness, not luck: agents are scored on risk-adjusted return (<ConceptPill concept="psr" label="PSR(0)" />,{" "}
              <ConceptPill concept="calmar" label="Calmar" />) and on how they hold up in regimes they were not tuned for (
              <ConceptPill concept="ood" label="OOD survival" />
              ).
            </li>
            <li>Hard risk limits: an agent whose equity breaches the 5% maintenance margin is liquidated and scores ACS 0, whatever it earned before.</li>
            <li>Reproducibility: the run is fully determined by its seed, so anyone can re-run it and check the final state digest.</li>
          </ul>
        </Pro>
      </PageHead>

      <Panel
        title="Stage pipeline"
        subtitle={pro ? "Four stress stages, run in order on one kernel. Deployed custom agents are included automatically." : "Four stress stages, run in order on one kernel"}
        explain={{
          what: "The four stages of the suite. Each one injects a specific market shock and then lets the market evolve for the chosen number of ticks. The suite builds a new kernel from the seed, so it never touches the live arena's state.",
          how: pro
            ? "Pick a seed and a stage length, then run. Longer stages give the statistics more data and take a little longer to compute. After completion each row shows where the market ended."
            : "Press Run. Each row lights as its stage runs, then shows where the market ended and who led. Switch to Pro to pick the seed and stage length.",
          math: "Each tick is one 10 ms fast-loop step. Stages run back to back on the same kernel, so a shock in stage 2 can still be hurting agents in stage 3. Basis = (CLOB mid − Revm spot) / Revm spot × 10,000 bps.",
        }}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
            <button
              type="button"
              className={btn("primary", "lg")}
              onClick={start}
              disabled={running || !seedValid}
              aria-busy={running}
            >
              {running ? "Running the benchmark…" : "Run the benchmark"}
            </button>
            <Pro>
              <label className={cn(field, "w-[150px]")}>
                <span className={fieldLabel}>Seed</span>
                <input
                  className={input}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={seedText}
                  onChange={(e) => setSeedText(e.target.value)}
                  aria-invalid={!seedValid}
                  disabled={running}
                />
              </label>
              <div className={field}>
                <span className={fieldLabel}>Ticks per stage</span>
                <Segmented<TicksOption>
                  ariaLabel="Ticks per stage"
                  value={ticks}
                  onChange={(v) => !running && setTicks(v)}
                  options={[
                    { value: 100, label: <span className={num}>100</span> },
                    { value: 200, label: <span className={num}>200</span> },
                    { value: 400, label: <span className={num}>400</span> },
                  ]}
                />
              </div>
            </Pro>
            <p className={cn(caption, "max-w-[40em] basis-full")}>
              Same seed, same result. Seed <span className={num}>{seedValid ? seed : "—"}</span> with <span className={num}>{ticks}</span> ticks per stage
              (<span className={num}>{ticks * 4}</span> total) always ends in the same {HASH_LABEL.toLowerCase()}, as long as the same set of agents is
              deployed.
            </p>
            {!seedValid ? (
              <span className="basis-full font-sans text-[12.5px] text-ask" role="alert">
                Enter a whole number between 0 and 4,294,967,295.
              </span>
            ) : null}
          </div>
          <StagePipeline running={running} progress={progress} result={result} />
        </div>
      </Panel>

      <Panel
        title="Scorecard"
        subtitle={
          showResult && result
            ? `Seed ${result.seed} · ${result.totalTicks.toLocaleString("en-US")} ticks · ${result.agents.length} agents`
            : running
              ? "Being computed"
              : "Fills in when the suite finishes"
        }
        actions={
          showResult && result ? (
            <Pro>
              <button type="button" className={btn("ghost", "sm")} onClick={() => downloadJson(result)}>
                Download JSON report
              </button>
              <button
                type="button"
                className={btn("ghost", "sm")}
                onClick={() => {
                  setShowReport(true);
                  setPrintRequested(true);
                }}
              >
                Printable report
              </button>
            </Pro>
          ) : undefined
        }
        explain={{
          what: "Final scores for every agent after all four stages, ranked by grade and Apex Composite Score. A liquidated agent is struck through and scores 0.",
          how: "Read the Apex score on the right; the line under each name is its grade and kind. Pro adds the PSR, Calmar and Survival parts, the sortable detailed table and the per-stage heatmap.",
          math: `${ACS_FORMULA}. Worst drop is the deepest peak-to-trough equity fall during the run.`,
        }}
      >
        {showResult && result ? (
          <div className="flex flex-col gap-2">
            <div className={tableScroll}>
              <Leaderboard rows={boardRows} precise={pro} caption={`Benchmark scorecard, seed ${result.seed}`} />
            </div>
            <WeightBar />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className={cn(empty, "px-0 py-2")}>
              {running
                ? "The scorecard appears as soon as the last stage closes."
                : "Run the suite to grade every agent through calm flow, toxic flow, a whale shock and a flash cascade."}
            </p>
            <WeightBar />
          </div>
        )}
      </Panel>

      <Pro>
        {showResult && result ? (
          <>
            <ResultSummary result={result} replication={replication} />

            <Panel
              title="Detailed scorecard"
              subtitle="Every metric, sortable, with each agent's equity over the run"
              explain={{
                what: "Final scores for every agent after all four stages, with a letter grade derived from ACS.",
                how: "Click any column header to sort. The sparkline is each agent's equity over the whole run; mint if it finished above where it started, vermilion if below.",
                math: `${ACS_FORMULA}. Max drawdown is the worst peak-to-trough equity drop during the run. Win rate is the share of equity changes that were gains.`,
              }}
              flush
            >
              <div className="border-b border-rule py-3">
                <GradeLegend />
              </div>
              <Scorecard result={result} />
            </Panel>

            <Panel
              title="ACS by stage"
              subtitle="Each agent's score at the close of every stage"
              explain={{
                what: "A heatmap of ACS read from the leaderboard at the end of each stage. Stronger mint is a higher score; amber is below the 0.35 floor and vermilion marks a liquidation.",
                how: "Read across a row to see where an agent broke down. A drop between columns shows which shock hurt it most.",
              }}
              flush
            >
              <StageMatrix result={result} />
            </Panel>

            {showReport ? (
              <PrintReport result={result} generatedAt={generatedAt} onPrint={() => window.print()} onClose={() => setShowReport(false)} />
            ) : null}
          </>
        ) : (
          <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-2">
            <Panel title={running ? "Scorecard is being computed" : "What you will get"} subtitle="After all four stages finish">
              <div className="flex flex-col gap-4">
                <ul className="grid list-none grid-cols-1 gap-x-6 sm:grid-cols-2">
                  {[
                    ["Letter grade", "S, A, B, C or F from ACS. Liquidated agents always get F."],
                    ["ACS and its parts", "PSR(0), capped Calmar and OOD survival, each on a 0 to 1 scale."],
                    ["Risk record", "Max drawdown, win rate and final equity for every agent."],
                    ["Per-stage heatmap", "ACS at the end of each stage, showing which shock hurt whom."],
                    ["Equity curves", "A sparkline of each agent's equity across the whole run."],
                    ["Exportable report", "JSON with seed, state digest and formula, plus a print view."],
                  ].map(([k, v]) => (
                    <li key={k} className="flex flex-col gap-1 border-b border-rule py-2.5">
                      <strong className="font-sans text-[13.5px] font-semibold text-bone [font-variation-settings:'wdth'_108]">{k}</strong>
                      <span className="font-sans text-[13px] leading-[1.45] text-bone-2">{v}</span>
                    </li>
                  ))}
                </ul>
                <GradeLegend />
                <p className={caption}>
                  Stages:{" "}
                  {STAGE_META.map((m) => m.name.charAt(0).toLowerCase() + m.name.slice(1)).join(", ")}.
                </p>
              </div>
            </Panel>
            <LiveStandings entries={frame.leaderboard} tick={frame.tick} />
          </div>
        )}
      </Pro>
    </div>
  );
}

function ResultSummary({
  result,
  replication,
}: {
  result: BenchmarkResult;
  replication: { match: boolean; count: number } | null;
}) {
  const ranked = rankAgents(result.agents);
  const winner = ranked[0];
  const liquidated = result.agents.filter((a) => a.status === "LIQ").length;
  const avgAcs = result.agents.reduce((s, a) => s + a.acsScoreBps, 0) / Math.max(1, result.agents.length) / 10000;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4" role="region" aria-label="Run summary">
      <KpiCard
        label="Top agent"
        value={
          <span className="font-sans text-[24px] font-[560] tracking-[-0.02em] [font-variation-settings:'wdth'_110]">
            {winner ? displayAgentName(winner.agentId) : "—"}
          </span>
        }
        sub={
          winner ? (
            <>
              <GradeChip info={gradeFor(winner)} />
              <span>ACS {unit(winner.acsScoreBps, 3)}</span>
            </>
          ) : null
        }
      />
      <KpiCard
        label="Survivors"
        accent={liquidated ? "ask" : "bid"}
        value={
          <span>
            {result.agents.length - liquidated} / {result.agents.length}
          </span>
        }
        sub={liquidated ? `${liquidated} liquidated at the 5% maintenance margin` : "No agent breached the 5% maintenance margin"}
        concept="margin"
      />
      <KpiCard
        label="Field average ACS"
        accent="evm"
        value={<span>{avgAcs.toFixed(3)}</span>}
        sub={`Across ${result.agents.length} agents, liquidations counted as 0`}
        concept="acs"
      />
      <KpiCard
        label={`Final ${HASH_LABEL}`}
        accent="chaos"
        concept="determinism"
        value={
          <span className="text-[length:clamp(16px,1.4vw,20px)] break-all" title={result.stateHash}>
            {shortHash(result.stateHash, 10)}
          </span>
        }
        sub={
          replication ? (
            replication.match ? (
              <span className="text-bid">Identical across {replication.count} runs with this seed</span>
            ) : (
              <span className="text-ask">Differs from an earlier run with this seed</span>
            )
          ) : (
            `Seed ${result.seed}. Run it again to confirm the digest repeats.`
          )
        }
      />
    </div>
  );
}

function LiveStandings({ entries, tick }: { entries: LeaderboardEntryUi[]; tick: number }) {
  return (
    <Panel
      title="Live, unofficial standings"
      subtitle={`From the running arena at tick ${tick.toLocaleString("en-US")}`}
      explain={{
        what: "The current leaderboard of the live arena. It reflects whatever shocks and manual trades have happened so far, so it is not comparable across visitors.",
        how: "Use it as a reference only. The benchmark gives every agent the same seeded conditions, which makes its grades comparable.",
      }}
      flush
    >
      <div className={tableScroll}>
        <table className={cn(table, "min-w-[420px]")}>
          <thead>
            <tr>
              <th scope="col" className={cn(th, "text-right")}>
                #
              </th>
              <th scope="col" className={th}>Agent</th>
              <th scope="col" className={th}>Provisional grade</th>
              <th scope="col" className={cn(th, "text-right")}>
                ACS
              </th>
              <th scope="col" className={cn(th, "text-right")}>
                Equity
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const kind = agentKind(e.badge);
              return (
                <tr key={e.agentId}>
                  <td className={cn(tdNum, "text-bone-3")}>{i + 1}</td>
                  <td className={td}>
                    <span className="font-sans text-[14px] text-bone">{displayAgentName(e.agentId)}</span>{" "}
                    <span className="font-sans text-[12px] text-bone-3">{kind.label}</span>
                  </td>
                  <td className={td}>
                    <GradeChip info={gradeFor(e)} />
                  </td>
                  <td className={tdNum}>{unit(e.acsScoreBps, 3)}</td>
                  <td className={tdNum}>{fmtUsd(e.equityUsd, 0)}</td>
                </tr>
              );
            })}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className={empty}>
                  Waiting for the first frame from the arena.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
