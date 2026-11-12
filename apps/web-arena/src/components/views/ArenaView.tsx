"use client";

import { useArena } from "../../lib/arena";
import { ArenaChart } from "../arena/ArenaChart";
import { ExecutionDock } from "../arena/ExecutionDock";
import { HeroKpis } from "../arena/HeroKpis";
import { OrderBook } from "../arena/OrderBook";
import { SidePanel } from "../arena/SidePanel";
import { Badge } from "../ui";
import s from "../arena/arena.module.css";

export function ArenaView() {
  const { frame, paused } = useArena();
  return (
    <div className={s.view}>
      <header className={s.head}>
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <h1 className="h2">Live trading arena</h1>
          <p className="body text-3">
            One order book, one on-chain AMM, five competing agents and your own desk, all running in a deterministic engine. Trade, arbitrage, or inject a crash and watch who survives.
          </p>
        </div>
        <div className={s.headMeta}>
          <Badge tone={paused ? "chaos" : "bid"}>{paused ? "Paused" : "Live"}</Badge>
          <Badge>
            Tick <span className="num">{frame.tick.toLocaleString("en-US")}</span>
          </Badge>
          <Badge tone="evm">
            Block <span className="num">#{frame.blockNumber.toLocaleString("en-US")}</span>
          </Badge>
        </div>
      </header>

      <HeroKpis />

      <div className={s.workspace}>
        <div className={s.colLeft}>
          <OrderBook />
        </div>
        <div className={s.colCenter}>
          <ArenaChart />
          <ExecutionDock />
        </div>
        <div className={s.colRight}>
          <SidePanel />
        </div>
      </div>
    </div>
  );
}
