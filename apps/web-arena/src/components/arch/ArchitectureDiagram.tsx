"use client";

import React, { useMemo, useState } from "react";
import { Badge, Panel, Segmented } from "../ui";
import { useReducedMotion } from "./useReducedMotion";
import { EDGES, FLOW_INFO, LAYERS, NODES, type ArchNode, type FlowMode, type Tone } from "./archData";
import s from "./arch.module.css";

const toneVar = (t: Tone | undefined) => (t && t !== "neutral" ? `var(--${t})` : "var(--text-3)");

const KERNEL_CHIPS = new Set(["chaos", "ecology", "scoring", "digest"]);

function NodeShape({
  node,
  selected,
  dimmed,
  onSelect,
}: {
  node: ArchNode;
  selected: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
}) {
  const compact = node.h <= 56 && node.w < 120;
  return (
    <g
      className={`${s.node} ${dimmed ? s.dim : ""}`}
      data-selected={selected}
      style={{ ["--accent" as string]: toneVar(node.tone) }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${node.label}: ${node.sub}. Show details.`}
      onClick={() => onSelect(node.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(node.id);
        }
      }}
    >
      <rect className={s.nodeRect} x={node.x} y={node.y} width={node.w} height={node.h} rx={10} />
      <rect className={s.nodeAccent} x={node.x} y={node.y + 10} width={3} height={node.h - 20} rx={1.5} />
      <text className={s.nodeLabel} x={node.x + (compact ? 12 : 16)} y={node.y + (compact ? 24 : 26)}>
        {node.label}
      </text>
      <text className={s.nodeSub} x={node.x + (compact ? 12 : 16)} y={node.y + (compact ? 44 : 47)}>
        {node.sub}
      </text>
    </g>
  );
}

export function ArchitectureDiagram() {
  const [selected, setSelected] = useState<string>("kernel");
  const [flow, setFlow] = useState<FlowMode>("all");
  const reducedMotion = useReducedMotion();
  const node = NODES.find((n) => n.id === selected) ?? NODES[0];

  const activeNodes = useMemo(() => new Set(NODES.filter((n) => n.flows.includes(flow)).map((n) => n.id)), [flow]);

  const flowTone = flow === "fast" ? "var(--chaos)" : flow === "macro" ? "var(--llm)" : flow === "proof" ? "var(--evm)" : "var(--text-3)";

  return (
    <div className={s.diagramGrid}>
      <Panel
        title="System architecture"
        subtitle="Click any component to see what it does, the invariants it keeps, and where it lives."
        explain={{
          what: "Three layers: a deterministic Rust core, bridges that expose it to the command line and to Python / LLM agents, and the browser workstation you are using now.",
          how: "Pick a flow to highlight only the components it touches. Nodes are keyboard focusable — Tab to one and press Enter.",
          math: "Every arrow into the Rust core carries integers: prices and quantities are i64 pips with SCALE = 10⁸, so the same seed produces the same bytes everywhere.",
        }}
      >
        <div className="stack" style={{ ["--gap" as string]: "14px" }}>
          <div style={{ overflowX: "auto", maxWidth: "100%" }}>
            <Segmented<FlowMode>
              ariaLabel="Highlight a data flow"
              value={flow}
              onChange={setFlow}
              options={(Object.keys(FLOW_INFO) as FlowMode[]).map((k) => ({ value: k, label: FLOW_INFO[k].label }))}
            />
          </div>
          <p className="caption" style={{ fontSize: 13, color: "var(--text-2)" }}>
            <span className="dot" style={{ ["--accent" as string]: flowTone, marginRight: 8 }} />
            {FLOW_INFO[flow].caption}
          </p>

          <div className={s.svgScroller}>
            <svg
              className={s.svg}
              viewBox="0 0 1100 594"
              role="group"
              aria-label="ApexArena architecture diagram"
            >
              <defs>
                <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill="var(--text-4)" />
                </marker>
                {(["evm", "bid", "llm", "chaos"] as const).map((t) => (
                  <marker key={t} id={`arch-arrow-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0 0 L10 5 L0 10 z" fill={`var(--${t})`} />
                  </marker>
                ))}
              </defs>

              {LAYERS.map((l) => (
                <g key={l.id}>
                  <rect className={s.layerBand} x={16} y={l.y} width={1068} height={l.h} rx={14} />
                  <text className={s.layerLabel} x={40} y={l.y + 28}>
                    {l.label}
                    <tspan className={s.layerCaption} dx={12}>
                      {l.caption}
                    </tspan>
                  </text>
                </g>
              ))}

              <text className={s.svgNote} x={40} y={252}>
                Native code is reached two ways: the CLI for snapshots
              </text>
              <text className={s.svgNote} x={40} y={274}>
                and proofs, and PyO3 for Python agents and the MCP
              </text>
              <text className={s.svgNote} x={40} y={296}>
                server. Both drive the exact same ArenaKernel.
              </text>
              <text className={s.svgNote} x={40} y={556}>
                Integer-only and seeded: same seed, same bytes, same hash.
              </text>

              {/* Kernel frame groups the four sub-systems. */}
              <rect className={`${s.kernelFrame} ${activeNodes.has("kernel") ? "" : s.dim}`} x={692} y={424} width={376} height={142} rx={14} />

              {EDGES.map((e, i) => {
                const active = e.flows.includes(flow);
                const tone = flow === "all" ? e.tone : active ? (flow === "fast" ? "chaos" : flow === "macro" ? "llm" : "evm") : undefined;
                const stroke = tone ? `var(--${tone})` : undefined;
                return (
                  <g key={i} className={active ? "" : s.dim}>
                    <path
                      id={`arch-edge-${i}`}
                      className={`${s.edge} ${e.dashed ? s.edgeDashed : ""} ${active && flow !== "all" ? s.edgeActive : ""}`}
                      d={e.d}
                      style={stroke ? { stroke } : undefined}
                      markerEnd={`url(#arch-arrow${tone ? `-${tone}` : ""})`}
                    />
                    {e.label ? (
                      <text className={s.edgeLabel} x={e.lx} y={e.ly} textAnchor={e.anchor ?? "middle"}>
                        {e.label}
                      </text>
                    ) : null}
                    {active && flow !== "all" && !reducedMotion ? (
                      <circle r={4} className={s.flowDot} style={{ ["--accent" as string]: stroke }}>
                        <animateMotion dur={flow === "fast" ? "1.2s" : "2.4s"} repeatCount="indefinite" rotate="auto">
                          <mpath href={`#arch-edge-${i}`} />
                        </animateMotion>
                      </circle>
                    ) : null}
                  </g>
                );
              })}

              {NODES.map((n) => (
                <NodeShape
                  key={n.id}
                  node={n}
                  selected={n.id === selected}
                  dimmed={!activeNodes.has(n.id)}
                  onSelect={setSelected}
                />
              ))}
            </svg>
          </div>

          {/* Narrow screens: same nodes as a stacked list, top layer first. */}
          <div className={s.mobileLayers}>
            {LAYERS.map((l, li) => (
              <React.Fragment key={l.id}>
                <div className={s.mobileLayer}>
                  <span className="label">{l.label}</span>
                  {NODES.filter((n) => n.layer === l.id).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={s.mobileNode}
                      aria-pressed={n.id === selected}
                      style={{
                        ["--accent" as string]: toneVar(n.tone),
                        opacity: activeNodes.has(n.id) ? 1 : 0.4,
                        marginLeft: KERNEL_CHIPS.has(n.id) ? 16 : 0,
                        width: KERNEL_CHIPS.has(n.id) ? "calc(100% - 16px)" : "100%",
                      }}
                      onClick={() => setSelected(n.id)}
                    >
                      <span className="dot" style={{ ["--accent" as string]: toneVar(n.tone) }} />
                      <span className="stack" style={{ ["--gap" as string]: "0px" }}>
                        <strong>{n.label}</strong>
                        <span className="caption">{n.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {li < LAYERS.length - 1 ? (
                  <div className={s.mobileArrow} aria-hidden>
                    ↓ calls into
                  </div>
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Panel>

      <div className={s.detail}>
        <Panel
          title={node.label}
          subtitle={LAYERS.find((l) => l.id === node.layer)?.label}
          actions={node.tone !== "neutral" ? <Badge tone={node.tone}>{node.tone === "llm" ? "agents" : node.tone === "bid" ? "CLOB" : node.tone === "evm" ? "revm" : node.tone}</Badge> : undefined}
        >
          <div className="stack" style={{ ["--gap" as string]: "18px" }} aria-live="polite">
            <div className="row" style={{ alignItems: "stretch", gap: 12 }}>
              <span className={s.accentBar} style={{ ["--accent" as string]: toneVar(node.tone) }} />
              <p className="body" style={{ fontSize: 14 }}>
                {node.what}
              </p>
            </div>

            <div className="stack" style={{ ["--gap" as string]: "8px" }}>
              <span className="label">Invariants it keeps</span>
              <ul className={s.detailList}>
                {node.invariants.map((inv) => (
                  <li key={inv}>{inv}</li>
                ))}
              </ul>
            </div>

            <div className="stack" style={{ ["--gap" as string]: "8px" }}>
              <span className="label">Where it lives</span>
              {node.files.map((f) => (
                <span key={f} className={s.path}>
                  {f}
                </span>
              ))}
            </div>

            <div className="stack" style={{ ["--gap" as string]: "8px" }}>
              <span className="label">Key types and functions</span>
              <div className={s.chips}>
                {node.symbols.map((sym) => (
                  <code key={sym} className={s.chip}>
                    {sym}
                  </code>
                ))}
              </div>
            </div>

            <div className="row wrap" style={{ gap: 6 }}>
              <span className="caption">Part of:</span>
              {node.flows
                .filter((f) => f !== "all")
                .map((f) => (
                  <button key={f} type="button" className="btn btn-sm btn-ghost" onClick={() => setFlow(f)}>
                    {FLOW_INFO[f].label}
                  </button>
                ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
