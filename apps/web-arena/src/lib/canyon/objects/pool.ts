import * as THREE from "three";
import { FS_LINE, FS_POINT, POOL_AXIS_VS, POOL_VS } from "../shaders";
import { POOL_ORIGIN, POOL_SCALE } from "../cast";
import { shaderMat, staged, type Uniforms } from "./util";

export const POOL_O = new THREE.Vector3(...POOL_ORIGIN);
export const POOL_S = POOL_SCALE;

/** On-chain pool: the curve x·y=k as a ribbon of points (20 rows deep) + two axis lines. */
export function buildPool(U: Uniforms, OU: Uniforms, mobile: boolean): THREE.Object3D[] {
  const N = mobile ? 900 : 2200, pos = new Float32Array(N * 3), aR = new Float32Array(N), aRnd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = 0.34 * Math.pow(3.0 / 0.34, (i % 110) / 109), row = Math.floor(i / 110);
    pos[i * 3] = POOL_O.x + r * POOL_S;
    pos[i * 3 + 1] = POOL_S / r;
    pos[i * 3 + 2] = POOL_O.z + (row / 19 - 0.5) * 2.2;
    aR[i] = r; aRnd[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aR", new THREE.BufferAttribute(aR, 1));
  g.setAttribute("aRnd", new THREE.BufferAttribute(aRnd, 1));
  const ax = [POOL_O.x, 0, POOL_O.z, POOL_O.x + 5.8, 0, POOL_O.z, POOL_O.x, 0, POOL_O.z, POOL_O.x, 5.8, POOL_O.z];
  const ag = new THREE.BufferGeometry();
  ag.setAttribute("position", new THREE.Float32BufferAttribute(ax, 3));
  return [
    staged(new THREE.Points(g, shaderMat(U, POOL_VS, FS_POINT, OU)), 5),
    staged(new THREE.LineSegments(ag, shaderMat(U, POOL_AXIS_VS, FS_LINE, OU)), 5),
  ];
}
