import * as THREE from "three";
import { NODE_FS, NODE_VS } from "../shaders";
import { shaderMat, staged, type Uniforms } from "./util";

/** Agent nodes 0–4, the pool bead (5) and the visitor's order slug (6). aKind: 1 reasoning, 0 quant, 2 bead, 3 slug. */
export function buildNodes(U: Uniforms, OU: Uniforms): { points: THREE.Points; geo: THREE.BufferGeometry } {
  const n = 7, geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute("aKind", new THREE.BufferAttribute(new Float32Array([1, 1, 0, 0, 0, 2, 3]), 1));
  geo.setAttribute("aPulse", new THREE.BufferAttribute(new Float32Array(n), 1));
  geo.setAttribute("aLife", new THREE.BufferAttribute(new Float32Array([1, 1, 1, 1, 1, 1, 0]), 1));
  return { points: staged(new THREE.Points(geo, shaderMat(U, NODE_VS, NODE_FS, OU)), 8), geo };
}
