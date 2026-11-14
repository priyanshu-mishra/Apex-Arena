/** The scene's opening market status (three-free, so the DOM readouts can import it). */
import { REAL } from "./real";
import type { SceneStatus } from "./scene";

/**
 * The scene's base ETH price: the engine's seed-42 order-book mid from
 * real.json, so the live scene, the status line and chapter 01 show one price.
 */
export const BASE_MID = REAL.mid;

/** The scene's starting status; also what the readouts show before it mounts and without WebGL. */
export const INITIAL_STATUS: Readonly<SceneStatus> = {
  tick: 0,
  mid: BASE_MID,
  spreadBps: 4,
  lambda: 0.2,
  regime: "calm",
  pool: BASE_MID,
  gapBps: 0,
};
