"use client";

import { useArena } from "../../lib/arena";
import { Pro } from "../../lib/density";
import { ArenaChart } from "../arena/ArenaChart";
import { ExecutionDock } from "../arena/ExecutionDock";
import { HeroKpis } from "../arena/HeroKpis";
import { OrderBook } from "../arena/OrderBook";
import { SidePanel } from "../arena/SidePanel";
import { Badge } from "../ui";
import { PageHead } from "./PageHead";
import { page } from "../ui/kit";

/**
 * Arena. Simple: price chart, order book, order ticket, leaderboard.
 * Pro adds the readout strip, chart views, depth toggle, AMM swap, stress
 * lab, receipts, the Revm stream and agent reasoning.
 */
export function ArenaView() {
  const { frame, paused } = useArena();
  return (
    <div className={page}>
      <PageHead
        title="The arena"
        lede="One order book, one on-chain pool, four agents and your own desk, all in one deterministic engine. Trade against them, or switch to Pro and break the market on purpose."
        meta={
          <Pro>
            <Badge tone={paused ? "chaos" : "bid"}>{paused ? "paused" : "live"}</Badge>
            <Badge>tick {frame.tick.toLocaleString("en-US")}</Badge>
            <Badge tone="evm">block #{frame.blockNumber.toLocaleString("en-US")}</Badge>
          </Pro>
        }
      />

      <Pro>
        <HeroKpis />
      </Pro>

      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <div className="order-2 min-w-0 xl:order-1">
          <OrderBook />
        </div>
        <div className="order-1 flex min-w-0 flex-col gap-5 xl:order-2">
          <ArenaChart />
          <ExecutionDock />
        </div>
        <div className="order-3 min-w-0">
          <SidePanel />
        </div>
      </div>
    </div>
  );
}
