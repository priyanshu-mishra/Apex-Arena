"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { agentKind, displayAgentName, fmtUsd, useArena } from "../../lib/arena";
import type { BenchmarkResult, LeaderboardEntryUi } from "../../lib/sharedBuffer";
import { Badge, ConceptPill, KpiCard, Panel, Segmented } from "../ui";
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
import { CheckIcon, LockIcon } from "../bench/StageIcons";
import styles from "../bench/Bench.module.css";

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

  return (
    <div className={styles.page}>
      {/* ---------------- Header + configuration ---------------- */}
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1 className="h2">Chaos benchmark suite</h1>
          <p className="lead">
            One standardized test every agent takes under identical conditions. A fresh deterministic kernel runs four
            stress stages back to back, then grades each agent on the Apex Composite Score. The live arena keeps
            running while it works.
          </p>
          <ul className={styles.proofList}>
            <li>
              <CheckIcon />
              <span>
                Robustness, not luck: agents are scored on risk-adjusted return (<ConceptPill concept="psr" label="PSR(0)" />,{" "}
                <ConceptPill concept="calmar" label="Calmar" />) and on how they hold up in regimes they were not tuned for (
                <ConceptPill concept="ood" label="OOD survival" />
                ).
              </span>
            </li>
            <li>
              <CheckIcon />
              <span>
                Hard risk limits: an agent whose equity breaches the 5% maintenance margin is liquidated and scores
                ACS 0, whatever it earned before.
              </span>
            </li>
            <li>
              <CheckIcon />
              <span>
                Reproducibility: the run is fully determined by its seed, so anyone can re-run it and check the final
                state digest.
              </span>
            </li>
          </ul>
        </div>

        <Panel
          title="Run configuration"
          subtitle="Deployed custom agents are included automatically"
          explain={{
            what: "Settings for one offline benchmark run. The suite builds a new kernel from the seed, so it never touches the live arena's state.",
            how: "Pick a seed and a stage length, then run. Longer stages give the statistics more data and take a little longer to compute.",
            math: "Each tick is one 10 ms fast-loop step. Stages run back to back on the same kernel, so a shock in stage 2 can still be hurting agents in stage 3.",
          }}
        >
          <div className={styles.config}>
            <div className={styles.configRow}>
              <label className="field">
                <span className="field-label">Seed</span>
                <input
                  className="input num"
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
              <div className="field">
                <span className="field-label">Ticks per stage</span>
                <Segmented<TicksOption>
                  ariaLabel="Ticks per stage"
                  value={ticks}
                  onChange={(v) => !running && setTicks(v)}
                  options={[
                    { value: 100, label: <span className="num">100</span> },
                    { value: 200, label: <span className="num">200</span> },
                    { value: 400, label: <span className="num">400</span> },
                  ]}
                />
              </div>
            </div>
            {!seedValid ? (
              <span className="caption" style={{ color: "var(--ask)" }} role="alert">
                Enter a whole number between 0 and 4,294,967,295.
              </span>
            ) : null}
            <button
              type="button"
              className={`btn btn-primary btn-lg ${styles.runBtn}`}
              onClick={start}
              disabled={running || !seedValid}
              aria-busy={running}
            >
              {running ? "Running benchmark…" : "Run standardized benchmark suite"}
            </button>
            <p className={styles.determinism}>
              <LockIcon />
              <span>
                Same seed, same result. Seed <span className="num">{seedValid ? seed : "—"}</span> with{" "}
                <span className="num">{ticks}</span> ticks per stage (<span className="num">{ticks * 4}</span> total)
                always ends in the same {HASH_LABEL.toLowerCase()}, as long as the same set of agents is deployed.
              </span>
            </p>
          </div>
        </Panel>
      </div>

      {/* ---------------- Stage pipeline ---------------- */}
      <Panel
        title="Stage pipeline"
        subtitle="Four stress stages, run in order on one kernel"
        explain={{
          what: "The four stages of the suite. Each one injects a specific market shock and then lets the market evolve for the chosen number of ticks.",
          how: "Watch the active stage while it runs. After completion each card shows where the market ended: regime, CLOB mid vs Revm AMM spot, cross-venue basis, Hawkes intensity and the agent leading on ACS at that point.",
          math: "Basis = (CLOB mid − Revm spot) / Revm spot × 10,000 bps. Hawkes λ is the self-exciting order-arrival intensity; it spikes during cascades.",
        }}
      >
        <StagePipeline running={running} progress={progress} result={result} />
      </Panel>

      {showResult && result ? (
        <>
          {/* ---------------- Summary ---------------- */}
          <ResultSummary result={result} replication={replication} />

          {/* ---------------- Scorecard ---------------- */}
          <Panel
            title="Institutional scorecard"
            subtitle={`Seed ${result.seed} · ${result.totalTicks.toLocaleString("en-US")} ticks · ${result.agents.length} agents`}
            actions={
              <span className="row wrap" style={{ ["--gap" as string]: "8px" }}>
                <button type="button" className="btn btn-sm" onClick={() => downloadJson(result)}>
                  Download JSON report
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-evm"
                  onClick={() => {
                    setShowReport(true);
                    setPrintRequested(true);
                  }}
                >
                  Printable report
                </button>
              </span>
            }
            explain={{
              what: "Final scores for every agent after all four stages, with a letter grade derived from ACS.",
              how: "Click any column header to sort. The sparkline is each agent's equity over the whole run; green if it finished above where it started, rose if below.",
              math: `${ACS_FORMULA}. Max drawdown is the worst peak-to-trough equity drop during the run. Win rate is the share of equity changes that were gains.`,
            }}
            flush
          >
            <div className="stack" style={{ ["--gap" as string]: "0px" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                <GradeLegend />
              </div>
              <Scorecard result={result} />
            </div>
          </Panel>

          <Panel
            title="ACS by stage"
            subtitle="Each agent's score at the close of every stage"
            explain={{
              what: "A heatmap of ACS read from the leaderboard at the end of each stage. Darker green is a higher score; rose marks a liquidation.",
              how: "Read across a row to see where an agent broke down. A drop between columns shows which shock hurt it most.",
            }}
            flush
          >
            <StageMatrix result={result} />
          </Panel>

          {showReport ? (
            <PrintReport
              result={result}
              generatedAt={generatedAt}
              onPrint={() => window.print()}
              onClose={() => setShowReport(false)}
            />
          ) : null}
        </>
      ) : (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <Panel
            title={running ? "Scorecard is being computed" : "What you will get"}
            subtitle="After all four stages finish"
          >
            <div className="stack" style={{ ["--gap" as string]: "16px" }}>
              <p className="body">
                Run the suite to stress every agent through{" "}
                {STAGE_META.map((s, i) => (
                  <span key={s.key}>
                    {i > 0 ? (i === STAGE_META.length - 1 ? " and " : ", ") : ""}
                    <span style={{ color: `var(--${s.tone})` }}>{s.name.charAt(0).toLowerCase() + s.name.slice(1)}</span>
                  </span>
                ))}
                . The result is an institutional scorecard you can sort, download as JSON or print.
              </p>
              <ul className={styles.previewCols}>
                <li>
                  <strong>Letter grade</strong>S, A, B, C or F from ACS. Liquidated agents always get F.
                </li>
                <li>
                  <strong>ACS and its parts</strong>PSR(0), capped Calmar and OOD survival, each on a 0 to 1 scale.
                </li>
                <li>
                  <strong>Risk record</strong>Max drawdown, win rate and final equity for every agent.
                </li>
                <li>
                  <strong>Per-stage heatmap</strong>ACS at the end of each stage, showing which shock hurt whom.
                </li>
                <li>
                  <strong>Equity curves</strong>A sparkline of each agent's equity across the whole run.
                </li>
                <li>
                  <strong>Exportable report</strong>JSON with seed, state digest and formula, plus a print view.
                </li>
              </ul>
              <GradeLegend />
            </div>
          </Panel>

          <LiveStandings entries={frame.leaderboard} tick={frame.tick} />
        </div>
      )}
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
    <div className={styles.summary}>
      <KpiCard
        label="Top agent"
        accent="llm"
        value={<span style={{ fontFamily: "var(--font-sans)", fontSize: 22 }}>{winner ? displayAgentName(winner.agentId) : "—"}</span>}
        sub={
          winner ? (
            <span className="row" style={{ ["--gap" as string]: "8px" }}>
              <GradeChip info={gradeFor(winner)} />
              <span className="num">ACS {unit(winner.acsScoreBps, 3)}</span>
            </span>
          ) : null
        }
      />
      <KpiCard
        label="Survivors"
        accent={liquidated ? "ask" : "bid"}
        value={
          <span className="num">
            {result.agents.length - liquidated} / {result.agents.length}
          </span>
        }
        sub={liquidated ? `${liquidated} liquidated at the 5% maintenance margin` : "No agent breached the 5% maintenance margin"}
        concept="margin"
      />
      <KpiCard
        label="Field average ACS"
        accent="evm"
        value={<span className="num">{avgAcs.toFixed(3)}</span>}
        sub={`Across ${result.agents.length} agents, liquidations counted as 0`}
        concept="acs"
      />
      <KpiCard
        label={`Final ${HASH_LABEL}`}
        accent="chaos"
        concept="determinism"
        value={
          <span className={styles.hashValue} title={result.stateHash}>
            {shortHash(result.stateHash, 10)}
          </span>
        }
        sub={
          replication ? (
            replication.match ? (
              <span style={{ color: "var(--bid)" }}>Identical across {replication.count} runs with this seed</span>
            ) : (
              <span style={{ color: "var(--ask)" }}>Differs from an earlier run with this seed</span>
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
      <div className={styles.tableScroll}>
        <table className="table" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              <th scope="col" className="r">
                #
              </th>
              <th scope="col">Agent</th>
              <th scope="col">Provisional grade</th>
              <th scope="col" className="r">
                ACS
              </th>
              <th scope="col" className="r">
                Equity
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const kind = agentKind(e.badge);
              return (
                <tr key={e.agentId}>
                  <td className="r num">{i + 1}</td>
                  <td>
                    <span className={styles.agentCell}>
                      <span className={styles.agentName}>{displayAgentName(e.agentId)}</span>
                      <Badge tone={kind.tone}>{kind.label}</Badge>
                    </span>
                  </td>
                  <td>
                    <GradeChip info={gradeFor(e)} />
                  </td>
                  <td className="r num">{unit(e.acsScoreBps, 3)}</td>
                  <td className="r num">{fmtUsd(e.equityUsd, 0)}</td>
                </tr>
              );
            })}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty">
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
