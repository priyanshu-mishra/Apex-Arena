import * as THREE from "three";
import { NL } from "../model";
import { FS_LINE, FS_POINT, GATE_FACE_VS, GATE_NODE_FS, GATE_NODE_VS, GATE_TERRAIN_VS, GATE_THREAD_VS } from "../shaders";
import { lcg, setAttrs, shaderMat, staged, type Uniforms } from "./util";

/** The gate's boot scene (gate.html): single-copy terrain, now face, price thread and five nodes, all driven by uRise / uExtent / uAgents. */
export function buildGate(U: Uniforms, mobile: boolean): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  {
    const ROWS = mobile ? 64 : 120, COLS = mobile ? 30 : 46, FILL = mobile ? 2500 : 7000, n = ROWS * COLS * 2 + FILL;
    const aU = new Float32Array(n), aSide = new Float32Array(n), aRow = new Float32Array(n), aRnd = new Float32Array(n), aFill = new Float32Array(n);
    const rnd = lcg(42);
    let i = 0;
    for (let r = 0; r < ROWS; r++)
      for (let s = -1; s <= 1; s += 2)
        for (let j = 0; j < COLS; j++) { aU[i] = (j + 0.5) / COLS; aSide[i] = s; aRow[i] = r / ROWS; aRnd[i] = rnd(); i++; }
    for (let k = 0; k < FILL; k++) { aU[i] = Math.pow(rnd(), 0.8); aSide[i] = k % 2 ? 1 : -1; aRnd[i] = rnd(); aFill[i] = 1; i++; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    setAttrs(g, { aU, aSide, aRow, aRnd, aFill });
    out.push(staged(new THREE.Points(g, shaderMat(U, GATE_TERRAIN_VS, FS_POINT)), 1));
  }
  {
    const ul: number[] = [], hl: number[] = [], sd: number[] = [];
    for (let s = -1; s <= 1; s += 2) {
      const pts: [number, number][] = [[0, 0]];
      for (let l = 0; l < NL; l++) { pts.push([l, l + 1]); pts.push([l + 1, l + 1]); }
      for (let q = 0; q < pts.length - 1; q++) for (const p of [pts[q], pts[q + 1]]) { ul.push(p[0]); hl.push(p[1]); sd.push(s); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ul.length * 3), 3));
    g.setAttribute("aUL", new THREE.Float32BufferAttribute(ul, 1));
    g.setAttribute("aHL", new THREE.Float32BufferAttribute(hl, 1));
    g.setAttribute("aSide", new THREE.Float32BufferAttribute(sd, 1));
    out.push(staged(new THREE.LineSegments(g, shaderMat(U, GATE_FACE_VS, FS_LINE)), 3));
  }
  {
    const N = 420, a = new Float32Array(N);
    for (let i = 0; i < N; i++) a[i] = Math.pow(i / (N - 1), 1.6);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute("aAge", new THREE.BufferAttribute(a, 1));
    out.push(staged(new THREE.Line(g, shaderMat(U, GATE_THREAD_VS, FS_LINE)), 4));
  }
  {
    const P = [[-5.2, 4.6, 1.8], [4.3, 5.0, 1.2], [1.6, 3.2, 2.6], [-2.2, 3.6, 2.2], [5.6, 3.3, 2.8]];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P.flat(), 3));
    g.setAttribute("aKind", new THREE.Float32BufferAttribute([1, 1, 0, 0, 0], 1));
    g.setAttribute("aI", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4], 1));
    out.push(staged(new THREE.Points(g, shaderMat(U, GATE_NODE_VS, GATE_NODE_FS)), 8));
  }
  return out;
}
