import { GATE } from "@/content/landing";
import g from "./gate.module.css";

/**
 * The gate's three start-up steps. A step is `done` once the boot timeline has
 * reached it; "done" is read out only for lit steps.
 */
export function BootList({ lit }: { lit: number }) {
  return (
    <ol className={g.boot} aria-label={GATE.bootLabel}>
      {GATE.boot.map((step, i) => {
        const done = i < lit;
        return (
          <li key={step.text} data-state={done ? "done" : "pending"}>
            <i>{step.at.toFixed(2)} s</i>
            <span>{step.text}</span>
            <em aria-hidden={!done}>{GATE.done}</em>
          </li>
        );
      })}
    </ol>
  );
}
