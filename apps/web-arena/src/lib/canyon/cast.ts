/** Who and what lives in the Canyon scene (three-free, so labels can import it without the WebGL bundle). */
import type { Vec3 } from "./chapters";

export type AgentSpec = {
  name: string;
  /** Plain label. */
  kind: string;
  /** Precise label (engine agent kind). */
  pk: string;
  /** Reasoning (LLM) agents pulse together on the 1 s barrier. */
  llm: boolean;
  /** Position in the hero (chapter 00) staging. */
  hero: Vec3;
};

export const AGENTS: readonly AgentSpec[] = [
  { name: "Gemini-2.5", kind: "reasoning", pk: "AiReasoning", llm: true, hero: [-5.2, 4.6, 1.8] },
  { name: "DeepSeek-R1", kind: "reasoning", pk: "AiReasoning", llm: true, hero: [4.3, 5.0, 1.2] },
  { name: "Hawkes-HFT", kind: "quant", pk: "QuantAlgo", llm: false, hero: [1.6, 3.2, 2.6] },
  { name: "MM-Alpha", kind: "quant", pk: "QuantAlgo", llm: false, hero: [-2.2, 3.6, 2.2] },
  { name: "You", kind: "by hand", pk: "manual desk", llm: false, hero: [5.6, 3.3, 2.8] },
];

/** Score-chapter x positions; heights come from the real ACS (0.3 + ACS × 5.4); You floats at 1.0. */
export const SCORE_X: readonly number[] = [-1.6, 0.5, 2.6, 4.7, 7.2];

/** The x·y=k pool: origin and scale in world units. */
export const POOL_ORIGIN: Vec3 = [8.0, 0, -5];
export const POOL_SCALE = 1.6;
