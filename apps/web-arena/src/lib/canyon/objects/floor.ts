import * as THREE from "three";
import { LEN } from "../model";
import { FLOOR_VS, FS_LINE } from "../shaders";
import { shaderMat, staged, type Uniforms } from "./util";

/** Floor grid: fixed price lines every 1.5 units running into the past, cross lines every 4 z units. */
export function buildFloor(U: Uniforms): THREE.LineSegments {
  const p: number[] = [], a: number[] = [];
  for (let x = -12; x <= 12; x += 1.5) { p.push(x, 0, 0, x, 0, -LEN); a.push(0, 1); }
  for (let z = 0; z >= -LEN; z -= 4) { p.push(-12, 0, z, 12, 0, z); a.push(-z / LEN, -z / LEN); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("aAge", new THREE.Float32BufferAttribute(a, 1));
  return staged(new THREE.LineSegments(g, shaderMat(U, FLOOR_VS, FS_LINE)), 0);
}
