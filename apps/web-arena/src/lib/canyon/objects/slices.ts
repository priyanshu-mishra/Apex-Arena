import * as THREE from "three";
import { NL, SPAN } from "../model";
import { FS_LINE, SLICE_VS } from "../shaders";
import { shaderMat, staged, type Uniforms } from "./util";

/** K stepped depth-chart outlines (both sides), one per slice index. */
export function sliceGeo(K: number): THREE.BufferGeometry {
  const k: number[] = [], ul: number[] = [], hl: number[] = [], sd: number[] = [];
  for (let r = 0; r < K; r++)
    for (let s = -1; s <= 1; s += 2) {
      const pts: [number, number][] = [[0, 0]];
      for (let l = 0; l < NL; l++) { pts.push([l, l + 1]); pts.push([l + 1, l + 1]); }
      for (let q = 0; q < pts.length - 1; q++)
        for (const p of [pts[q], pts[q + 1]]) { k.push(r); ul.push(p[0]); hl.push(p[1]); sd.push(s); }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(k.length * 3), 3));
  g.setAttribute("aK", new THREE.Float32BufferAttribute(k, 1));
  g.setAttribute("aUL", new THREE.Float32BufferAttribute(ul, 1));
  g.setAttribute("aHL", new THREE.Float32BufferAttribute(hl, 1));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(sd, 1));
  return g;
}

/** The "now" face silhouette (×5 run copies) + one rib per second of history (the 1 s barrier). */
export function buildSlices(U: Uniforms): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const ribU = { uNow: { value: 0 }, uCopy: { value: 2 }, uAlpha: { value: 0.2 } };
  out.push(staged(new THREE.LineSegments(sliceGeo(SPAN), shaderMat(U, SLICE_VS, FS_LINE, ribU)), 2));
  const nowGeo = sliceGeo(1);
  for (let c = 0; c < 5; c++)
    out.push(
      staged(
        new THREE.LineSegments(
          nowGeo,
          shaderMat(U, SLICE_VS, FS_LINE, { uNow: { value: 1 }, uCopy: { value: c }, uAlpha: { value: c === 2 ? 1 : 0.8 } }),
        ),
        3,
      ),
    );
  return out;
}
