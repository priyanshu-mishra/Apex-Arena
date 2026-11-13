import { COPY } from "@/content/landing";
import type { RealData } from "@/lib/canyon/real";
import { cn } from "@/lib/utils";

type Row = RealData["leaderboard"][number];

const fmt = (n: number, d: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (bps: number) => `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${Math.abs(bps)} bps`;

const HEAD = COPY.c5.head;

/* Styles are utilities, not the landing module, so the app can reuse the table.
 * `leading-none` follows every font size: tailwind-merge drops an earlier one. */
const TH =
  "pb-[10px] pl-3 text-right align-bottom font-sans text-[12px] leading-[1.2] font-normal text-bone-2 border-b border-rule-2 first:pl-0 first:text-left";
const TD =
  "whitespace-nowrap py-[15px] pl-3 text-right align-baseline font-mono text-[13px] leading-none border-b border-rule max-[860px]:py-[10px] max-[860px]:pl-2 max-[860px]:text-[12px]";
const WHO =
  "pl-0 max-[860px]:pl-0 text-left font-sans text-[length:clamp(17px,1.5vw,21px)] max-[860px]:text-[length:clamp(17px,1.5vw,21px)] font-[560] leading-none tracking-[-0.01em] [font-variation-settings:'wdth'_110]";
const ROLE =
  "mt-[6px] block whitespace-normal font-sans text-[12px] leading-none font-normal tracking-normal text-bone-2 [font-variation-settings:'wdth'_100]";
const ACS =
  "w-[1%] text-[length:clamp(24px,2.7vw,40px)] font-medium tracking-[-0.03em] [font-variation-settings:'wdth'_80] max-[860px]:text-[length:clamp(24px,2.7vw,40px)] leading-none";
/** Under 860px the table drops Profit and Worst drop (guide §8). */
const WIDE = "max-[860px]:hidden";

/**
 * The real leaderboard: hairline rows with name and role, profit, worst
 * drop and a big Apex score. A liquidated row is struck through with a
 * vermilion score and the words of its role. `precise` adds the PSR,
 * Calmar and Survival columns; their cells carry `data-pc`, so the landing
 * page can also reveal them from its Plain / Precise switch in CSS.
 */
export function Leaderboard({ rows, precise, caption }: { rows: readonly Row[]; precise: boolean; caption?: string }) {
  const pc = precise ? "" : "hidden";
  return (
    <table className="w-full border-collapse tabular-nums">
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <thead>
        <tr>
          <th scope="col" className={TH}>
            {HEAD.agent}
          </th>
          <th scope="col" className={cn(TH, WIDE)}>
            {HEAD.profit}
          </th>
          <th scope="col" className={cn(TH, WIDE)}>
            {HEAD.drop}
          </th>
          <th scope="col" className={cn(TH, pc)} data-pc="">
            {HEAD.psr}
          </th>
          <th scope="col" className={cn(TH, pc)} data-pc="">
            {HEAD.calmar}
          </th>
          <th scope="col" className={cn(TH, pc)} data-pc="">
            {HEAD.survival}
          </th>
          <th scope="col" className={TH}>
            {HEAD.acs}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const dead = r.liquidated;
          const tone = dead ? "text-bone-3" : r.pnlBps > 0 ? "text-bid" : r.pnlBps < 0 ? "text-ask" : "";
          const cell = cn(TD, dead && "text-bone-3");
          return (
            <tr key={r.agentId} data-liquidated={dead || undefined}>
              <td className={cn(cell, WHO, dead && "line-through decoration-1")}>
                {r.agentId}
                <small className={cn(ROLE, dead && "text-ask")}>{r.role}</small>
              </td>
              <td className={cn(cell, WIDE, tone)}>{signed(r.pnlBps)}</td>
              <td className={cn(cell, WIDE)}>{`${r.maxDrawdownBps} bps`}</td>
              <td className={cn(cell, pc)} data-pc="">
                {fmt(r.psr, 4)}
              </td>
              <td className={cn(cell, pc)} data-pc="">
                {fmt(r.calmar, 4)}
              </td>
              <td className={cn(cell, pc)} data-pc="">
                {fmt(r.survival, 4)}
              </td>
              <td className={cn(cell, ACS, dead && "text-ask")}>{fmt(r.acs, 3)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
