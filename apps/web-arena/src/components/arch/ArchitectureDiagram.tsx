"use client";

import React, { useMemo, useState } from "react";
import { cn } from "../../lib/utils";
import { Badge, Panel, Segmented } from "../ui";
import { btn, dot, label, mono12, toneColor } from "../ui/kit";
import { useReducedMotion } from "./useReducedMotion";
import { EDGES, FLOW_INFO, LAYERS, NODES, type ArchNode, type FlowMode, type Tone } from "./archData";

const toneVar = (t: Tone | undefined) => (t && t !== "neutral" ? toneColor(t) : "var(--bone-3)");
/** Edge / flow tone → colour: fast loop amber, macro bone, proof pool blue. */
const EDGE_TONE: Record<string, string> = { evm: "var(--pool)", bid: "var(--bid)", llm: "var(--bone)", chaos: "var(--shock)" };
const DIM = "opacity-[0.22]";

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
      className={cn("group cursor-pointer outline-none transition-opacity duration-200", dimmed && DIM)}
      data-selected={selected}
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
      <rect
        className={cn(
          "fill-ink-2 stroke-rule-2 transition-[fill,stroke] duration-150 group-hover:fill-haze group-focus-visible:stroke-bone",
          selected && "fill-haze stroke-bone",
        )}
        strokeWidth={selected ? 1.5 : 1}
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={2}
      />
      <rect x={node.x + (compact ? 12 : 16)} y={node.y + (compact ? 15 : 17)} width={7} height={7} rx={1} style={{ fill: toneVar(node.tone) }} />
      <text className="pointer-events-none fill-bone font-sans text-[15px] font-semibold" x={node.x + (compact ? 25 : 29)} y={node.y + (compact ? 24 : 26)}>
        {node.label}
      </text>
      <text className="pointer-events-none fill-bone-3 font-sans text-[14px]" x={node.x + (compact ? 12 : 16)} y={node.y + (compact ? 44 : 47)}>
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

  const flowTone = flow === "fast" ? "var(--shock)" : flow === "macro" ? "var(--bone)" : flow === "proof" ? "var(--pool)" : "var(--bone-3)";

  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <Panel
        title="System architecture"
        subtitle="Click any component to see what it does, the invariants it keeps, and where it lives."
        explain={{
          what: "Three layers: a deterministic Rust core, bridges that expose it to the command line and to Python / LLM agents, and the browser workstation you are using now.",
          how: "Pick a flow to highlight only the components it touches (fast loop in amber, macro epoch in bone, proof in blue). Nodes are keyboard focusable — Tab to one and press Enter.",
          math: "Every arrow into the Rust core carries integers: prices and quantities are i64 pips with SCALE = 10⁸, so the same seed produces the same bytes everywhere.",
        }}
      >
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="max-w-full">
            <Segmented<FlowMode>
              ariaLabel="Highlight a data flow"
              value={flow}
              onChange={setFlow}
              options={(Object.keys(FLOW_INFO) as FlowMode[]).map((k) => ({ value: k, label: FLOW_INFO[k].label }))}
            />
          </div>
          <p className="flex items-center gap-2 font-sans text-[13px] text-bone-2">
            <span className={dot} style={{ background: flowTone }} />
            {FLOW_INFO[flow].caption}
          </p>

          <div className="max-w-full overflow-x-auto max-[760px]:hidden">
            <svg
              className="block h-auto w-full min-w-[980px] font-sans"
              viewBox="0 0 1100 594"
              role="group"
              aria-label="ApexArena architecture diagram"
            >
              <defs>
                <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill="var(--bone-3)" />
                </marker>
                {(["evm", "bid", "llm", "chaos"] as const).map((t) => (
                  <marker key={t} id={`arch-arrow-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0 0 L10 5 L0 10 z" fill={EDGE_TONE[t]} />
                  </marker>
                ))}
              </defs>

              {LAYERS.map((l) => (
                <g key={l.id}>
                  <rect className="fill-ink stroke-rule" strokeWidth={1} x={16} y={l.y} width={1068} height={l.h} rx={2} />
                  <text className="fill-bone font-sans text-[15px] font-semibold" x={40} y={l.y + 28}>
                    {l.label}
                    <tspan className="fill-bone-3 text-[14px] font-normal" dx={12}>
                      {l.caption}
                    </tspan>
                  </text>
                </g>
              ))}

              <text className="fill-bone-3 font-sans text-[14px]" x={40} y={252}>
                Native code is reached two ways: the CLI for snapshots
              </text>
              <text className="fill-bone-3 font-sans text-[14px]" x={40} y={274}>
                and proofs, and PyO3 for Python agents and the MCP
              </text>
              <text className="fill-bone-3 font-sans text-[14px]" x={40} y={296}>
                server. Both drive the exact same ArenaKernel.
              </text>
              <text className="fill-bone-3 font-sans text-[14px]" x={40} y={556}>
                Integer-only and seeded: same seed, same bytes, same hash.
              </text>

              {/* Kernel frame groups the four sub-systems. */}
              <rect className={cn("fill-none stroke-rule-2 [stroke-dasharray:3_4]", !activeNodes.has("kernel") && DIM)} x={692} y={424} width={376} height={142} rx={2} />

              {EDGES.map((e, i) => {
                const active = e.flows.includes(flow);
                const tone = flow === "all" ? e.tone : active ? (flow === "fast" ? "chaos" : flow === "macro" ? "llm" : "evm") : undefined;
                const stroke = tone ? EDGE_TONE[tone] : undefined;
                return (
                  <g key={i} className={cn("transition-opacity duration-200", !active && DIM)}>
                    <path
                      id={`arch-edge-${i}`}
                      className={cn("fill-none stroke-bone-3", e.dashed && "[stroke-dasharray:5_5]")}
                      strokeWidth={active && flow !== "all" ? 2 : 1.25}
                      d={e.d}
                      style={stroke ? { stroke } : undefined}
                      markerEnd={`url(#arch-arrow${tone ? `-${tone}` : ""})`}
                    />
                    {e.label ? (
                      <text className="fill-bone-3 stroke-ink font-sans text-[14px] [paint-order:stroke] [stroke-linejoin:round] [stroke-width:4px]" x={e.lx} y={e.ly} textAnchor={e.anchor ?? "middle"}>
                        {e.label}
                      </text>
                    ) : null}
                    {active && flow !== "all" && !reducedMotion ? (
                      <circle r={4} style={{ fill: stroke ?? "var(--pool)" }}>
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
          <div className="hidden flex-col gap-4 max-[760px]:flex">
            {LAYERS.map((l, li) => (
              <React.Fragment key={l.id}>
                <div className="flex flex-col gap-2">
                  <span className={label}>{l.label}</span>
                  {NODES.filter((n) => n.layer === l.id).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className="flex items-start gap-3 rounded-[2px] border border-rule-2 bg-ink px-3 py-2.5 text-left aria-pressed:border-bone aria-pressed:bg-haze"
                      aria-pressed={n.id === selected}
                      style={{
                        opacity: activeNodes.has(n.id) ? 1 : 0.4,
                        marginLeft: KERNEL_CHIPS.has(n.id) ? 16 : 0,
                        width: KERNEL_CHIPS.has(n.id) ? "calc(100% - 16px)" : "100%",
                      }}
                      onClick={() => setSelected(n.id)}
                    >
                      <span className={cn(dot, "mt-1.5")} style={{ background: toneVar(n.tone) }} />
                      <span className="flex flex-col gap-0.5">
                        <strong className="font-sans text-[14px] font-semibold text-bone">{n.label}</strong>
                        <span className="font-sans text-[12.5px] text-bone-3">{n.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {li < LAYERS.length - 1 ? (
                  <div className={cn(mono12, "text-bone-3")} aria-hidden>
                    ↓ calls into
                  </div>
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Panel>

      <div className="2xl:sticky 2xl:top-[72px]">
        <Panel
          title={node.label}
          subtitle={LAYERS.find((l) => l.id === node.layer)?.label}
          actions={node.tone !== "neutral" ? <Badge tone={node.tone}>{node.tone === "llm" ? "agents" : node.tone === "bid" ? "CLOB" : node.tone === "evm" ? "revm" : node.tone}</Badge> : undefined}
        >
          <div className="flex flex-col gap-5" aria-live="polite">
            <p className="font-sans text-[14px] leading-[1.55] text-bone-2">{node.what}</p>

            <div className="flex flex-col gap-2">
              <span className={label}>Invariants it keeps</span>
              <ul className="flex list-none flex-col font-sans text-[13.5px] leading-[1.5] text-bone [&>li]:border-b [&>li]:border-rule [&>li]:py-1.5">
                {node.invariants.map((inv) => (
                  <li key={inv}>{inv}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={label}>Where it lives</span>
              {node.files.map((f) => (
                <span key={f} className={cn(mono12, "break-all text-bone")}>
                  {f}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <span className={label}>Key types and functions</span>
              <div className="flex flex-wrap gap-1.5">
                {node.symbols.map((sym) => (
                  <code key={sym} className={cn(mono12, "rounded-[2px] border border-rule px-2 py-0.5 text-bone")}>
                    {sym}
                  </code>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-sans text-[12.5px] text-bone-3">Part of:</span>
              {node.flows
                .filter((f) => f !== "all")
                .map((f) => (
                  <button key={f} type="button" className={btn("ghost", "sm")} onClick={() => setFlow(f)}>
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
