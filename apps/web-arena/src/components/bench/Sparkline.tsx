"use client";

export function Sparkline({
  values,
  width = 112,
  height = 30,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  label?: string;
}) {
  if (values.length < 2) {
    return <span className="font-sans text-[12.5px] text-bone-3">No data</span>;
  }
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const first = values[0];
  const last = values[values.length - 1];
  const color = last >= first ? "var(--bid)" : "var(--ask)";
  const [lx, ly] = pts[pts.length - 1];
  const changePct = first ? ((last - first) / first) * 100 : 0;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label ? label + ": " : ""}equity ${changePct >= 0 ? "up" : "down"} ${Math.abs(changePct).toFixed(2)}% over the run`}
      style={{ display: "block", overflow: "visible" }}
    >
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.2} fill={color} />
    </svg>
  );
}
