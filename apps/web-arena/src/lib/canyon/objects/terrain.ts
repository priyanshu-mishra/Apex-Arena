import * as THREE from "three";
import { FS_POINT, TERRAIN_VS } from "../shaders";
import { lcg, setAttrs, shaderMat, staged, type Uniforms } from "./util";

/** Terrain: one point per (price level column × tick row × run copy), plus the now-face fill. */
export function buildTerrain(U: Uniforms, mobile: boolean): THREE.Points {
  const ROWS = mobile ? 64 : 120, COLS = mobile ? 30 : 46, COPIES = 5, FILL = mobile ? 2500 : 7000;
  const n = ROWS * COLS * 2 * COPIES + FILL;
  const aU = new Float32Array(n), aSide = new Float32Array(n), aRow = new Float32Array(n);
  const aRnd = new Float32Array(n), aCopy = new Float32Array(n), aFill = new Float32Array(n);
  const rnd = lcg(42);
  let i = 0;
  for (let c = 0; c < COPIES; c++)
    for (let r = 0; r < ROWS; r++)
      for (let s = -1; s <= 1; s += 2)
        for (let j = 0; j < COLS; j++) {
          aU[i] = (j + 0.5) / COLS; aSide[i] = s; aRow[i] = (r + c / COPIES) / ROWS; aRnd[i] = rnd(); aCopy[i] = c; i++;
        }
  for (let k = 0; k < FILL; k++) {
    aU[i] = Math.pow(rnd(), 0.8); aSide[i] = k % 2 ? 1 : -1; aRow[i] = 0; aRnd[i] = rnd(); aCopy[i] = k % COPIES; aFill[i] = 1; i++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  setAttrs(g, { aU, aSide, aRow, aRnd, aCopy, aFill });
  return staged(new THREE.Points(g, shaderMat(U, TERRAIN_VS, FS_POINT)), 1);
}
