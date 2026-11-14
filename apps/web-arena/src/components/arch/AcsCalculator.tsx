"use client";

import { useState, type ReactNode } from "react";
import { ConceptPill, Panel } from "../ui";
import { INITIAL_EQUITY_USD, MAINTENANCE_MARGIN_PCT, displayAgentName, useArena } from "../../lib/arena";
import { cn } from "../../lib/utils";
import { caption, dot, field, fieldLabel, input, label, mono12, num, range, select, table, td, tdNum, th } from "../ui/kit";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function SliderField({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
  concept,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: ReactNode;
  concept?: "psr" | "calmar" | "ood" | "margin";
}) {
  return (
    <div className={field}>
      <span className={fieldLabel}>
        <label htmlFor={id}>{label}</label>
        {concept ? <ConceptPill concept={concept} label="?" align="right" /> : null}
      </span>
      <div className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3">
        <input
          className={range}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          id={id}
          className={input}
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number(value.toFixed(4))}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
        />
      </div>
      {hint ? <span className={cn(caption, "text-[12px]")}>{hint}</span> : null}
    </div>
  );
}

export function AcsCalculator() {
  const { frame } = useArena();
  const [psr, setPsr] = useState(0.82);
  const [calmarRaw, setCalmarRaw] = useState(1.6);
  const [ood, setOod] = useState(0.7);
  const [penalty, setPenalty] = useState(0.15);
  const [equityPct, setEquityPct] = useState(101.4);
  const [source, setSource] = useState("");

  const calmar = clamp01(calmarRaw);
  const tPsr = 0.4 * psr;
  const tCalmar = 0.3 * calmar;
  const tOod = 0.2 * ood;
  const tPen = 0.1 * penalty;
  const gross = tPsr + tCalmar + tOod;
  const liquidated = equityPct < MAINTENANCE_MARGIN_PCT;
  const raw = gross - tPen;
  const acs = liquidated ? 0 : clamp01(raw);

  const loadAgent = (agentId: string) => {
    setSource(agentId);
    const a = frame.leaderboard.find((e) => e.agentId === agentId);
    if (!a) return;
    const p = a.psrBps / 10_000;
    const c = a.calmarBps / 10_000;
    const o = a.oodSurvivalBps / 10_000;
    setPsr(p);
    setCalmarRaw(c);
    setOod(o);
    // The leaderboard does not carry the turnover penalty; back it out of the reported ACS.
    const implied = a.status === "LIQ" ? 0 : (0.4 * p + 0.3 * c + 0.2 * o - a.acsScoreBps / 10_000) / 0.1;
    setPenalty(clamp01(Number(implied.toFixed(4))));
    setEquityPct(a.status === "LIQ" ? 4 : Number(((a.equityUsd / INITIAL_EQUITY_USD) * 100).toFixed(2)));
  };

  /* The landing weight bar's shades: bone at full, 70% and 45%; churn in vermilion. */
  const segs = [
    { key: "psr", label: "0.40 · PSR(0)", v: tPsr, color: "var(--bone)" },
    { key: "calmar", label: "0.30 · Calmar", v: tCalmar, color: "color-mix(in srgb, var(--bone) 70%, transparent)" },
    { key: "ood", label: "0.20 · Survival", v: tOod, color: "color-mix(in srgb, var(--bone) 45%, transparent)" },
  ];

  return (
    <Panel
      title="Apex score calculator"
      subtitle="The single benchmark number every agent is ranked by."
      explain={{
        what: "ACS blends statistical confidence that the agent has real edge, return per unit of drawdown, and survival in stress regimes it was not tuned for, minus a penalty for churning the book.",
        how: "Move the sliders or load a live agent from the leaderboard. Drop equity below 5% of the starting balance to see the liquidation rule take over.",
        math: "ACS = 0.40·PSR(0) + 0.30·min(max(Calmar, 0), 1) + 0.20·Survival_OOD − 0.10·Penalty_turnover, clamped to [0, 1]. The Rust engine computes it in integer basis points: (40·psr + 30·calmar + 20·ood − 10·penalty) / 100 in crates/apex-kernel/src/scoring.rs.",
      }}
      actions={
        <select
          className={cn(select, "h-[30px] w-auto max-w-[210px] text-[13px]")}
          aria-label="Load a live agent"
          value={source}
          onChange={(e) => loadAgent(e.target.value)}
        >
          <option value="">Load live agent…</option>
          {frame.leaderboard.map((a) => (
            <option key={a.agentId} value={a.agentId}>
              {displayAgentName(a.agentId)}
            </option>
          ))}
        </select>
      }
    >
      <div className="grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <SliderField id="acs-psr" label="PSR(0)" concept="psr" value={psr} min={0} max={1} step={0.01} onChange={setPsr} hint="Probability the true Sharpe ratio is above zero." />
          <SliderField
            id="acs-calmar"
            label="Calmar ratio (raw)"
            concept="calmar"
            value={calmarRaw}
            min={-1}
            max={5}
            step={0.05}
            onChange={setCalmarRaw}
            hint={
              <>
                Capped to [0, 1] → <span className={cn(num, "text-bone")}>{calmar.toFixed(2)}</span>
                {calmarRaw > 1 ? " (excess return beyond 1× drawdown earns nothing extra)" : calmarRaw < 0 ? " (losses floor at 0)" : ""}
              </>
            }
          />
          <SliderField id="acs-ood" label="OOD survival" concept="ood" value={ood} min={0} max={1} step={0.01} onChange={setOod} hint="Share of stress regimes survived, net of drawdown." />
          <SliderField id="acs-pen" label="Turnover penalty" value={penalty} min={0} max={1} step={0.01} onChange={setPenalty} hint="Rises with traded notional relative to starting equity." />
          <SliderField
            id="acs-eq"
            label="Equity / initial equity (%)"
            concept="margin"
            value={equityPct}
            min={0}
            max={200}
            step={0.5}
            onChange={setEquityPct}
            hint={`Maintenance margin: ${MAINTENANCE_MARGIN_PCT}% of starting equity.`}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <span className={label}>Apex Composite Score</span>
              <span
                className="font-mono text-[length:clamp(40px,4vw,60px)] leading-none font-medium tracking-[-0.03em] tabular-nums [font-variation-settings:'wdth'_80]"
                style={{ color: liquidated ? "var(--ask)" : "var(--bone)" }}
                aria-live="polite"
              >
                {acs.toFixed(4)}
              </span>
            </div>
            <span className={caption}>
              <span className={num}>{Math.round(acs * 10_000).toLocaleString("en-US")}</span> bps as reported by the engine
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <div
              className="relative flex h-[5px] w-full gap-[2px] bg-rule"
              role="img"
              aria-label={`Contributions: PSR ${tPsr.toFixed(3)}, Calmar ${tCalmar.toFixed(3)}, survival ${tOod.toFixed(3)}, minus penalty ${tPen.toFixed(3)}.`}
              style={{ opacity: liquidated ? 0.35 : 1 }}
            >
              {segs.map((g) => (
                <span key={g.key} className="h-full" style={{ width: `${g.v * 100}%`, background: g.color }} title={`${g.label} = ${g.v.toFixed(4)}`} />
              ))}
              {tPen > 0 ? (
                <span
                  className="absolute inset-y-0 bg-ask"
                  style={{ left: `${Math.max(0, gross - tPen) * 100}%`, width: `${Math.min(tPen, gross) * 100}%` }}
                  title={`− 0.10 · penalty = ${tPen.toFixed(4)}`}
                />
              ) : null}
            </div>
            <div className={cn(mono12, "flex justify-between text-bone-3")} aria-hidden>
              <span>0</span>
              <span>0.25</span>
              <span>0.50</span>
              <span>0.75</span>
              <span>1.00</span>
            </div>
          </div>

          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Term</th>
                <th className={cn(th, "text-right")}>Input</th>
                <th className={cn(th, "text-right")}>Weight</th>
                <th className={cn(th, "text-right")}>Contribution</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "PSR(0)", color: segs[0].color, input: psr, w: "0.40", c: tPsr },
                { name: "Calmar (capped)", color: segs[1].color, input: calmar, w: "0.30", c: tCalmar },
                { name: "OOD survival", color: segs[2].color, input: ood, w: "0.20", c: tOod },
                { name: "Turnover penalty", color: "var(--ask)", input: penalty, w: "−0.10", c: -tPen },
              ].map((r) => (
                <tr key={r.name}>
                  <td className={td}>
                    <span className={cn(dot, "mr-2")} style={{ background: r.color }} />
                    {r.name}
                  </td>
                  <td className={tdNum}>{r.input.toFixed(2)}</td>
                  <td className={tdNum}>{r.w}</td>
                  <td className={tdNum} style={{ color: r.c < 0 ? "var(--ask)" : undefined }}>
                    {r.c >= 0 ? "+" : "−"}
                    {Math.abs(r.c).toFixed(4)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className={cn(td, "font-semibold text-bone")}>ACS</td>
                <td className={td} />
                <td className={td} />
                <td className={cn(tdNum, "font-semibold")}>
                  {acs.toFixed(4)}
                </td>
              </tr>
            </tbody>
          </table>

          {liquidated ? (
            <div className="border-l border-rule-2 py-1 pl-3 font-sans text-[13.5px] leading-[1.5] text-bone-2" role="status">
              <strong className="font-semibold text-ask">Liquidated — ACS forced to 0.</strong> Equity is{" "}
              <span className={num}>{equityPct.toFixed(1)}%</span> of the starting balance, below the {MAINTENANCE_MARGIN_PCT}% maintenance margin. The
              engine force-closes the account, cancels its resting orders and disqualifies it, regardless of how good the other terms look (they would
              have scored <span className={num}>{clamp01(raw).toFixed(4)}</span>).
            </div>
          ) : raw < 0 ? (
            <div className="border-l border-rule-2 py-1 pl-3 font-sans text-[13.5px] leading-[1.5] text-bone-2" role="status">
              The penalty outweighs every positive term, so ACS is clamped at 0.
            </div>
          ) : (
            <p className={caption}>
              Account is solvent at <span className={num}>{equityPct.toFixed(1)}%</span> of starting equity. Maximum possible ACS is{" "}
              <span className={num}>0.90</span> — a perfect agent with zero turnover.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
