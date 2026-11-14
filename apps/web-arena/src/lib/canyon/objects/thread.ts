import * as THREE from "three";
import { FS_LINE, FS_POINT_LINE, threadVS } from "../shaders";
import { COLORS, shaderMat, staged, type Uniforms } from "./util";

/** Price thread (line + bead chain, ×5 run copies) + best bid / best ask along the floor. */
export function buildThread(U: Uniforms): THREE.Object3D[] {
  const N = 420, a = new Float32Array(N);
  for (let i = 0; i < N; i++) a[i] = Math.pow(i / (N - 1), 1.6);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute("aAge", new THREE.BufferAttribute(a, 1));
  const lineVS = threadVS(false), pointVS = threadVS(true);
  const u = (off: number, copy: number, alpha: number, col: THREE.Vector3) => ({
    uOff: { value: off }, uCopy: { value: copy }, uAlpha: { value: alpha }, uCol: { value: col },
  });
  const out: THREE.Object3D[] = [];
  for (let c = 0; c < 5; c++) {
    out.push(staged(new THREE.Line(g, shaderMat(U, lineVS, FS_LINE, u(0, c, 0.9, COLORS.bone))), 4));
    out.push(staged(new THREE.Points(g, shaderMat(U, pointVS, FS_POINT_LINE, u(0, c, 0.5, COLORS.bone))), 4));
  }
  out.push(staged(new THREE.Line(g, shaderMat(U, lineVS, FS_LINE, u(-1, 2, 0.55, COLORS.bid))), 4));
  out.push(staged(new THREE.Line(g, shaderMat(U, lineVS, FS_LINE, u(1, 2, 0.55, COLORS.ask))), 4));
  return out;
}
